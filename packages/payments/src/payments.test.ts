import { describe, expect, it } from "vitest";
import {
  CodProvider,
  FastPayProvider,
  QiCardProvider,
  signWebhookPayload,
  verifyWebhookSignature,
  ZainCashProvider,
} from "./index";

describe("sandbox payment providers", () => {
  it("COD succeeds", async () => {
    const result = await new CodProvider().initializePayment({
      orderId: "ord_1",
      amountIqd: 100_000,
      buyerEmail: "buyer@test.iq",
    });
    expect(result.status).toBe("SUCCEEDED");
    expect(result.sandbox).toBe(true);
  });

  it("ZainCash simulates failure", async () => {
    const result = await new ZainCashProvider().initializePayment({
      orderId: "ord_2",
      amountIqd: 50_000,
      buyerEmail: "buyer@test.iq",
      metadata: { simulate: "failure" },
    });
    expect(result.status).toBe("FAILED");
  });

  it("QiCard succeeds in sandbox", async () => {
    const result = await new QiCardProvider().initializePayment({
      orderId: "ord_3",
      amountIqd: 75_000,
      buyerEmail: "buyer@test.iq",
    });
    expect(result.status).toBe("SUCCEEDED");
    expect(result.provider).toBe("QICARD");
  });

  it("FastPay succeeds in sandbox", async () => {
    const result = await new FastPayProvider().initializePayment({
      orderId: "ord_4",
      amountIqd: 25_000,
      buyerEmail: "buyer@test.iq",
    });
    expect(result.status).toBe("SUCCEEDED");
  });
});

describe("webhook signature verification", () => {
  it("verifies valid signatures", () => {
    const payload = JSON.stringify({ orderId: "ord_1", status: "SUCCEEDED" });
    const secret = "test-webhook-secret";
    const signature = signWebhookPayload(payload, secret);
    expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
  });

  it("rejects invalid signatures", () => {
    const payload = JSON.stringify({ orderId: "ord_1" });
    expect(
      verifyWebhookSignature(payload, "bad-signature", "secret"),
    ).toBe(false);
  });
});
