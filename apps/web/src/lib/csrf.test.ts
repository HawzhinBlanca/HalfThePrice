import { describe, expect, it } from "vitest";
import { generateCsrfToken, validateCsrfToken } from "./csrf";

describe("CSRF tokens", () => {
  it("generates and validates tokens", () => {
    const token = generateCsrfToken();
    expect(validateCsrfToken(token)).toBe(true);
  });

  it("rejects tampered tokens", () => {
    const token = generateCsrfToken();
    expect(validateCsrfToken(`${token}x`)).toBe(false);
  });
});
