import { describe, expect, it, afterEach } from "vitest";
import { createSessionToken, verifySessionToken, type SessionUser } from "./auth";

describe("Session Auth & Rotation", () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;

  afterEach(() => {
    process.env.NEXTAUTH_SECRET = originalSecret;
  });

  const mockUser: SessionUser = {
    id: "user123",
    email: "user@example.com",
    name: "John Doe",
    role: "BUYER",
  };

  it("can create and verify a session token", async () => {
    process.env.NEXTAUTH_SECRET = "super_secure_primary_secret_key_12345";
    const token = await createSessionToken(mockUser);
    
    const verified = await verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(mockUser.id);
    expect(verified?.email).toBe(mockUser.email);
  });

  it("verifies tokens signed with old secrets after rotation (N-1 overlap)", async () => {
    // 1. Initial configuration: primary secret is secret_old
    process.env.NEXTAUTH_SECRET = "secret_old";
    const token = await createSessionToken(mockUser);

    // 2. Secret rotation: secret_new is prepended, secret_old is now N-1
    process.env.NEXTAUTH_SECRET = "secret_new,secret_old";

    // Verification must succeed against the rotated key
    const verified = await verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(mockUser.id);

    // 3. New token signed with secret_new also verifies successfully
    const newToken = await createSessionToken(mockUser);
    const verifiedNew = await verifySessionToken(newToken);
    expect(verifiedNew).not.toBeNull();
    expect(verifiedNew?.id).toBe(mockUser.id);
  });

  it("returns null for invalid token or completely wrong secrets", async () => {
    process.env.NEXTAUTH_SECRET = "secret_primary";
    const verified = await verifySessionToken("completely_invalid_token_string");
    expect(verified).toBeNull();
  });
});
