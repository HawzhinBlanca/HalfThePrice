/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { middleware } from "./middleware";
import { NextRequest } from "next/server";
import { generateCsrfToken } from "./lib/csrf";

vi.mock("next/server", async (importOriginal) => {
  const original = await importOriginal<typeof import("next/server")>();
  return {
    ...original,
    NextResponse: {
      ...original.NextResponse,
      next: vi.fn(() => ({ status: 200, headers: new Headers() })),
      json: vi.fn((body, init) => ({
        status: init?.status ?? 200,
        json: async () => body,
      })),
    } as any,
  };
});

describe("global middleware", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NEXTAUTH_SECRET = "test-secret-key-for-middleware-testing-123";
    process.env.CSRF_DISABLED = "false";
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
    } as any);
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it("allows GET requests without CSRF verification", async () => {
    const req = new NextRequest("http://localhost/api/listings", {
      method: "GET",
    });

    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it("blocks mutating requests if CSRF tokens are missing", async () => {
    const req = new NextRequest("http://localhost/api/listings", {
      method: "POST",
      body: "{}",
    });

    const res: any = await middleware(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("CSRF token missing");
  });

  it("allows mutating request with valid CSRF tokens", async () => {
    const token = generateCsrfToken();
    const req = new NextRequest("http://localhost/api/listings", {
      method: "POST",
      headers: {
        "x-csrf-token": token,
      },
    });
    // Set cookie
    req.cookies.set("htp_csrf", token);

    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it("excludes auth paths from CSRF check", async () => {
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: "{}",
    });

    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it("excludes payment webhook paths from CSRF check", async () => {
    const req = new NextRequest("http://localhost/api/payments/webhook/zaincash", {
      method: "POST",
      body: "{}",
    });

    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it("performs rate limit checks and returns 429 if rate limit exceeded", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 429,
      ok: false,
    } as any);

    const req = new NextRequest("http://localhost/api/listings", {
      method: "GET",
    });

    const res: any = await middleware(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.code).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("fails closed and returns 503 if the rate limit service fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network connection lost"));

    const req = new NextRequest("http://localhost/api/listings", {
      method: "GET",
    });

    const res: any = await middleware(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.code).toBe("RATE_LIMIT_SERVICE_FAILURE");
  });
});
