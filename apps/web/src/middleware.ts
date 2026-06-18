import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CSRF_COOKIE = "htp_csrf";
const CSRF_HEADER = "x-csrf-token";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function validateCsrfToken(token: string, secret: string): Promise<boolean> {
  const [nonce, signature] = token.split(".");
  if (!nonce || !signature) return false;

  const encoder = new TextEncoder();
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["verify"]
    );
    const sigBytes = new Uint8Array(
      signature.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );
    return crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(nonce)
    );
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  const isApiRequest = pathname.startsWith("/api/");
  const isMutatingMethod = ["POST", "PUT", "DELETE", "PATCH"].includes(method);

  // 1. CSRF Enforcement for mutating API requests
  if (isApiRequest && isMutatingMethod) {
    const isExcluded =
      pathname.startsWith("/api/auth/") ||
      pathname.startsWith("/api/payments/webhook/");

    if (!isExcluded && process.env.CSRF_DISABLED !== "true") {
      const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
      const headerToken = request.headers.get(CSRF_HEADER);
      const secret = process.env.NEXTAUTH_SECRET;

      if (!secret) {
        return NextResponse.json(
          { error: "Internal Server Error: Missing auth secret." },
          { status: 500 }
        );
      }

      if (!cookieToken || !headerToken) {
        return NextResponse.json(
          { error: "CSRF token missing.", code: "CSRF_INVALID" },
          { status: 403 }
        );
      }

      const isCookieValid = await validateCsrfToken(cookieToken, secret);
      const isHeaderValid = await validateCsrfToken(headerToken, secret);

      if (!isCookieValid || !isHeaderValid || !safeCompare(cookieToken, headerToken)) {
        return NextResponse.json(
          { error: "CSRF token invalid.", code: "CSRF_INVALID" },
          { status: 403 }
        );
      }
    }
  }

  // 2. Distributed Rate Limiting for public API requests
  if (isApiRequest && !pathname.startsWith("/api/internal/")) {
    const isRateLimitedEndpoint =
      pathname === "/api/listings" ||
      pathname.startsWith("/api/chat/") ||
      pathname.startsWith("/api/offers/");

    if (isRateLimitedEndpoint) {
      const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
      const key = `${ip}:${pathname}`;
      const internalSecret = process.env.NEXTAUTH_SECRET ?? "shared_internal_secret";

      try {
        const checkUrl = new URL("/api/internal/rate-limit", request.url);
        const res = await fetch(checkUrl.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-request": internalSecret,
          },
          body: JSON.stringify({ key, limit: 60, windowSeconds: 60 }),
        });

        if (res.status === 429) {
          return NextResponse.json(
            { error: "Too Many Requests.", code: "RATE_LIMIT_EXCEEDED" },
            { status: 429 }
          );
        }
      } catch (err) {
        console.error("Failed to check rate limit:", err);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
