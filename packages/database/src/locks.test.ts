import { describe, expect, it, vi } from "vitest";
import { hashStringToInt, acquireAdvisoryLock } from "./locks";

describe("Postgres Advisory Locking", () => {
  it("generates stable 32-bit signed integer hashes for strings", () => {
    const key1 = "offer_12345";
    const key2 = "offer_12345";
    const key3 = "offer_54321";

    const hash1 = hashStringToInt(key1);
    const hash2 = hashStringToInt(key2);
    const hash3 = hashStringToInt(key3);

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);

    // Assert that it is a 32-bit integer
    expect(Number.isInteger(hash1)).toBe(true);
    expect(hash1).toBeGreaterThanOrEqual(-2147483648);
    expect(hash1).toBeLessThanOrEqual(2147483647);
  });

  it("calls executeRaw with pg_advisory_xact_lock and the hashed key", async () => {
    const mockTx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
    } as any;

    const key = "test-advisory-key";
    const expectedHash = hashStringToInt(key);

    await acquireAdvisoryLock(mockTx, key);

    expect(mockTx.$executeRaw).toHaveBeenCalled();

    const callArgs = mockTx.$executeRaw.mock.calls[0];
    // In raw template strings, the first argument is an array of strings
    const queryArray = callArgs[0];
    
    // Log for debugging if structure is unexpected
    if (!Array.isArray(queryArray) && typeof queryArray !== "string") {
      console.log("Raw callArgs:", JSON.stringify(callArgs));
    }

    if (Array.isArray(queryArray)) {
      expect(queryArray[0]).toContain("SELECT pg_advisory_xact_lock(");
    } else {
      expect(queryArray).toContain("SELECT pg_advisory_xact_lock(");
    }
    
    expect(callArgs[1]).toBe(expectedHash);
  });
});
