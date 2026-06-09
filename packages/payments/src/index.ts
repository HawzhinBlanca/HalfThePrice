import { createHmac, timingSafeEqual } from "node:crypto";

export type PaymentProviderId = "COD" | "ZAINCASH" | "QICARD" | "FASTPAY";

export type PaymentIntentStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export interface PaymentInitRequest {
  orderId: string;
  amountIqd: number;
  buyerEmail: string;
  locale?: "en" | "ar" | "ku";
  metadata?: Record<string, string>;
}

export interface PaymentInitResult {
  provider: PaymentProviderId;
  status: PaymentIntentStatus;
  providerRef: string;
  redirectUrl?: string;
  sandbox: boolean;
  message: string;
}

export interface PaymentProvider {
  id: PaymentProviderId;
  sandbox: boolean;
  initializePayment(request: PaymentInitRequest): Promise<PaymentInitResult>;
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean;
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

abstract class MockGatewayProvider implements PaymentProvider {
  abstract id: PaymentProviderId;
  sandbox = true;

  async initializePayment(
    request: PaymentInitRequest,
  ): Promise<PaymentInitResult> {
    const shouldFail =
      request.metadata?.simulate === "failure" ||
      request.amountIqd <= 0;

    const providerRef = `sandbox-${this.id.toLowerCase()}-${request.orderId}`;

    if (shouldFail) {
      return {
        provider: this.id,
        status: "FAILED",
        providerRef,
        sandbox: true,
        message: `[SANDBOX] ${this.id} payment simulation failed.`,
      };
    }

    return {
      provider: this.id,
      status: "SUCCEEDED",
      providerRef,
      redirectUrl: `/checkout/mock/${this.id.toLowerCase()}?order=${request.orderId}`,
      sandbox: true,
      message: `[SANDBOX] ${this.id} payment simulated successfully.`,
    };
  }

  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    const expected = signPayload(payload, secret);
    try {
      return timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected),
      );
    } catch {
      return false;
    }
  }
}

export class CodProvider implements PaymentProvider {
  id: PaymentProviderId = "COD";
  sandbox = true;

  async initializePayment(
    request: PaymentInitRequest,
  ): Promise<PaymentInitResult> {
    return {
      provider: "COD",
      status: "SUCCEEDED",
      providerRef: `cod-${request.orderId}`,
      sandbox: true,
      message: "[SANDBOX] Cash on delivery order confirmed.",
    };
  }

  verifyWebhookSignature(): boolean {
    return true;
  }
}

export class ZainCashProvider extends MockGatewayProvider {
  id: PaymentProviderId = "ZAINCASH";
}

export class QiCardProvider extends MockGatewayProvider {
  id: PaymentProviderId = "QICARD";
}

export class FastPayProvider extends MockGatewayProvider {
  id: PaymentProviderId = "FASTPAY";
}

const providers: Record<PaymentProviderId, PaymentProvider> = {
  COD: new CodProvider(),
  ZAINCASH: new ZainCashProvider(),
  QICARD: new QiCardProvider(),
  FASTPAY: new FastPayProvider(),
};

export function getPaymentProvider(id: PaymentProviderId): PaymentProvider {
  return providers[id];
}

export function signWebhookPayload(payload: string, secret: string): string {
  return signPayload(payload, secret);
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = signPayload(payload, secret);
  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
  } catch {
    return false;
  }
}
