/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "./[provider]/route";
import { NextRequest } from "next/server";
import { prisma } from "@htp/database";
import { verifyWebhookSignature } from "@htp/payments";

vi.mock("@htp/database", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    paymentIntent: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@htp/payments", () => ({
  verifyWebhookSignature: vi.fn(),
}));

describe("payment webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAYMENT_WEBHOOK_SECRET = "test-secret";
  });

  it("returns 404 for unknown provider", async () => {
    const req = new NextRequest("http://localhost/api/payments/webhook/invalid", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req, { params: Promise.resolve({ provider: "invalid" }) });
    expect(res.status).toBe(404);
  });

  it("returns 401 for invalid signature", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(false);
    const req = new NextRequest("http://localhost/api/payments/webhook/zaincash", {
      method: "POST",
      body: JSON.stringify({ orderId: "123" }),
      headers: { "x-htp-signature": "bad" },
    });
    const res = await POST(req, { params: Promise.resolve({ provider: "zaincash" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 if order not found", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(true);
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null as any);
    const req = new NextRequest("http://localhost/api/payments/webhook/zaincash", {
      method: "POST",
      body: JSON.stringify({ orderId: "123" }),
    });
    const res = await POST(req, { params: Promise.resolve({ provider: "zaincash" }) });
    expect(res.status).toBe(404);
  });

  it("processes first webhook call successfully", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(true);
    const mockOrder = {
      id: "123",
      status: "PENDING_PAYMENT",
      paymentIntent: { id: "pi_123", providerRef: "prev" },
    };
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any);

    const req = new NextRequest("http://localhost/api/payments/webhook/zaincash", {
      method: "POST",
      body: JSON.stringify({ orderId: "123", status: "SUCCEEDED", providerRef: "new_ref" }),
    });
    const res = await POST(req, { params: Promise.resolve({ provider: "zaincash" }) });
    
    expect(res.status).toBe(200);
    expect(prisma.paymentIntent.update).toHaveBeenCalledWith({
      where: { id: "pi_123" },
      data: { status: "SUCCEEDED", providerRef: "new_ref" },
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "123" },
      data: expect.objectContaining({ status: "CONFIRMED" }),
    });
  });

  it("idempotently short-circuits if order is already processed", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(true);
    const mockOrder = {
      id: "123",
      status: "CONFIRMED",
      paymentIntent: { id: "pi_123", providerRef: "new_ref" },
    };
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any);

    const req = new NextRequest("http://localhost/api/payments/webhook/zaincash", {
      method: "POST",
      body: JSON.stringify({ orderId: "123", status: "SUCCEEDED", providerRef: "new_ref" }),
    });
    const res = await POST(req, { params: Promise.resolve({ provider: "zaincash" }) });
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain("already processed");
    expect(prisma.paymentIntent.update).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});
