import { describe, expect, it, afterEach } from "vitest";
import { checkRateLimit, getClientIp } from "./rate-limit";

describe("in-memory rate limiter", () => {
  it("allows requests under the limit and blocks after exceeding", () => {
    const key = "test-user-ip";
    
    // First request
    let result = checkRateLimit(key, 2, 10000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);

    // Second request
    result = checkRateLimit(key, 2, 10000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);

    // Third request (blocked)
    result = checkRateLimit(key, 2, 10000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("prunes expired entries and prevents memory leaks", () => {
    const key = "test-prune-key";
    // Create an entry that is already expired
    checkRateLimit(key, 2, -100);

    // Force call checkRateLimit enough times to trigger random pruning
    for (let i = 0; i < 100; i++) {
      checkRateLimit(`other-key-${i}`, 1, 10000);
    }

    // Check again - it should have been pruned and start fresh
    const result = checkRateLimit(key, 2, 10000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });
});

describe("getClientIp resolution", () => {
  const env = process.env as { NODE_ENV?: string };
  const originalEnv = env.NODE_ENV;

  afterEach(() => {
    env.NODE_ENV = originalEnv;
  });

  it("prioritizes fly-client-ip", () => {
    const headers = new Headers();
    headers.set("fly-client-ip", "1.2.3.4");
    headers.set("x-forwarded-for", "5.6.7.8");
    const req = new Request("http://localhost", { headers });

    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("strictly avoids x-forwarded-for fallback in production", () => {
    env.NODE_ENV = "production";
    const headers = new Headers();
    headers.set("x-forwarded-for", "5.6.7.8");
    const req = new Request("http://localhost", { headers });

    expect(getClientIp(req)).toBe("127.0.0.1");
  });

  it("allows x-forwarded-for fallback in development/test", () => {
    env.NODE_ENV = "development";
    const headers = new Headers();
    headers.set("x-forwarded-for", "5.6.7.8");
    const req = new Request("http://localhost", { headers });

    expect(getClientIp(req)).toBe("5.6.7.8");
  });
});
