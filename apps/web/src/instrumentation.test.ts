/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { register } from "./instrumentation";

describe("boot-time environment variable validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("passes when all required env vars are present with non-default values in production", async () => {
    (process.env as any).NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://user:pass@host/db";
    process.env.NEXTAUTH_SECRET = "secure-nextauth-secret-1234567890";
    process.env.PAYMENT_WEBHOOK_SECRET = "secure-webhook-secret-1234567890";
    process.env.CRON_SECRET = "secure-cron-secret-1234567890";
    process.env.CENTRIFUGO_TOKEN_SECRET = "secure-centrifugo-secret-1234567890";
    process.env.CENTRIFUGO_API_KEY = "secure-centrifugo-api-key-1234567890";

    await expect(register()).resolves.not.toThrow();
  });

  it("skips validation during build phase", async () => {
    (process.env as any).NODE_ENV = "production";
    process.env.NEXT_PHASE = "phase-production-build";
    // Missing required env vars should not throw because validation is skipped
    delete process.env.DATABASE_URL;

    await expect(register()).resolves.not.toThrow();
  });

  it("skips validation when SKIP_ENV_VALIDATION is true", async () => {
    (process.env as any).NODE_ENV = "production";
    process.env.SKIP_ENV_VALIDATION = "true";
    delete process.env.DATABASE_URL;

    await expect(register()).resolves.not.toThrow();
  });

  it("throws error in production if a required variable is missing", async () => {
    (process.env as any).NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://user:pass@host/db";
    process.env.NEXTAUTH_SECRET = "secure-nextauth-secret-1234567890";
    process.env.CENTRIFUGO_TOKEN_SECRET = "secure-centrifugo-secret-1234567890";
    process.env.CENTRIFUGO_API_KEY = "secure-centrifugo-api-key-1234567890";
    process.env.CRON_SECRET = "secure-cron-secret-1234567890";
    // PAYMENT_WEBHOOK_SECRET is missing
    delete process.env.PAYMENT_WEBHOOK_SECRET;

    await expect(register()).rejects.toThrow("CRITICAL CONFIG ERROR: Required environment variable PAYMENT_WEBHOOK_SECRET is missing.");
  });

  it("throws error in production if a secret matches its insecure default", async () => {
    (process.env as any).NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://user:pass@host/db";
    process.env.NEXTAUTH_SECRET = "change-me-in-production-use-openssl-rand-base64-32"; // Insecure default
    process.env.PAYMENT_WEBHOOK_SECRET = "secure-webhook-secret-1234567890";
    process.env.CENTRIFUGO_TOKEN_SECRET = "secure-centrifugo-secret-1234567890";
    process.env.CENTRIFUGO_API_KEY = "secure-centrifugo-api-key-1234567890";
    process.env.CRON_SECRET = "secure-cron-secret-1234567890";

    await expect(register()).rejects.toThrow("CRITICAL CONFIG ERROR: Environment variable NEXTAUTH_SECRET is set to the insecure default value. Please change it in production.");
  });
});
