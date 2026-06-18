/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "./[provider]/route";
import { NextRequest } from "next/server";
import { verifyWebhookSignature } from "@htp/payments";

const mockTx = {
  webhookEvent: {
    create: vi.fn(),
  },
  order: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  paymentIntent: {
    update: vi.fn(),
  },
};

vi.mock("@htp/database", () => ({
  prisma: {
    $transaction: vi.fn((callback) => callback(mockTx)),
  },
  correlationStorage: {
    run: vi.fn((ctx, callback) => callback()),
    getStore: vi.fn(() => ({ correlationId: "test-correlation-id" })),
  },
  getCorrelationId: vi.fn(() => "test-correlation-id"),
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
      headers: { "x-htp-signature": "bad", "x-htp-timestamp": String(Math.floor(Date.now() / 1000)) },
    });
    const res = await POST(req, { params: Promise.resolve({ provider: "zaincash" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 if order not found", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(true);
    vi.mocked(mockTx.webhookEvent.create).mockResolvedValue({} as any);
    vi.mocked(mockTx.order.findUnique).mockResolvedValue(null as any);
    
    const req = new NextRequest("http://localhost/api/payments/webhook/zaincash", {
      method: "POST",
      body: JSON.stringify({ orderId: "123" }),
      headers: { "x-htp-timestamp": String(Math.floor(Date.now() / 1000)) },
    });
    const res = await POST(req, { params: Promise.resolve({ provider: "zaincash" }) });
    expect(res.status).toBe(404);
  });

  it("processes first webhook call successfully", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(true);
    vi.mocked(mockTx.webhookEvent.create).mockResolvedValue({} as any);
    
    const mockOrder = {
      id: "123",
      status: "PENDING_PAYMENT",
      paymentIntent: { id: "pi_123", providerRef: "prev" },
    };
    vi.mocked(mockTx.order.findUnique).mockResolvedValue(mockOrder as any);

    const req = new NextRequest("http://localhost/api/payments/webhook/zaincash", {
      method: "POST",
      body: JSON.stringify({ orderId: "123", status: "SUCCEEDED", providerRef: "new_ref" }),
      headers: { "x-htp-timestamp": String(Math.floor(Date.now() / 1000)) },
    });
    const res = await POST(req, { params: Promise.resolve({ provider: "zaincash" }) });
    
    expect(res.status).toBe(200);
    expect(mockTx.paymentIntent.update).toHaveBeenCalledWith({
      where: { id: "pi_123" },
      data: { status: "SUCCEEDED", providerRef: "new_ref" },
    });
    expect(mockTx.order.update).toHaveBeenCalledWith({
      where: { id: "123" },
      data: expect.objectContaining({ status: "CONFIRMED" }),
    });
  });

  it("idempotently short-circuits if order is already processed", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(true);
    vi.mocked(mockTx.webhookEvent.create).mockResolvedValue({} as any);

    const mockOrder = {
      id: "123",
      status: "CONFIRMED",
      paymentIntent: { id: "pi_123", providerRef: "new_ref" },
    };
    vi.mocked(mockTx.order.findUnique).mockResolvedValue(mockOrder as any);

    const req = new NextRequest("http://localhost/api/payments/webhook/zaincash", {
      method: "POST",
      body: JSON.stringify({ orderId: "123", status: "SUCCEEDED", providerRef: "new_ref" }),
      headers: { "x-htp-timestamp": String(Math.floor(Date.now() / 1000)) },
    });
    const res = await POST(req, { params: Promise.resolve({ provider: "zaincash" }) });
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain("already processed");
    expect(mockTx.paymentIntent.update).not.toHaveBeenCalled();
    expect(mockTx.order.update).not.toHaveBeenCalled();
  });

  it("idempotently returns 200 if duplicate webhook event ID (P2002 error)", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(true);
    const dbError = new Error("Unique constraint violation");
    (dbError as any).code = "P2002";
    vi.mocked(mockTx.webhookEvent.create).mockRejectedValue(dbError);

    const req = new NextRequest("http://localhost/api/payments/webhook/zaincash", {
      method: "POST",
      body: JSON.stringify({ orderId: "123", status: "SUCCEEDED", providerRef: "new_ref" }),
      headers: { "x-htp-timestamp": String(Math.floor(Date.now() / 1000)) },
    });
    const res = await POST(req, { params: Promise.resolve({ provider: "zaincash" }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain("Event already processed");
    expect(mockTx.order.findUnique).not.toHaveBeenCalled();
  });

  it("returns 400 if timestamp header is missing", async () => {
    const req = new NextRequest("http://localhost/api/payments/webhook/zaincash", {
      method: "POST",
      body: JSON.stringify({ orderId: "123", status: "SUCCEEDED", providerRef: "new_ref" }),
    });
    const res = await POST(req, { params: Promise.resolve({ provider: "zaincash" }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Missing timestamp header.");
  });
});
