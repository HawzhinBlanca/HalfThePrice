import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { generateCsrfToken, validateCsrfToken } from "./csrf";

describe("CSRF tokens", () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret-value-for-csrf";
  });

  afterEach(() => {
    process.env.NEXTAUTH_SECRET = originalSecret;
  });

  it("generates and validates tokens", () => {
    const token = generateCsrfToken();
    expect(validateCsrfToken(token)).toBe(true);
  });

  it("rejects tampered tokens", () => {
    const token = generateCsrfToken();
    expect(validateCsrfToken(`${token}x`)).toBe(false);
  });
});
