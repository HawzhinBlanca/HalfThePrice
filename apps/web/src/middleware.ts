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

async function validateCsrfToken(token: string, secretString: string): Promise<boolean> {
  const parts = token.split(":");
  let kid = "0";
  let body = "";

  if (parts.length === 2) {
    kid = parts[0] || "0";
    body = parts[1] || "";
  } else {
    body = token;
  }

  const [nonce, signature] = body.split(".");
  if (!nonce || !signature) return false;

  const secrets = secretString.split(",").map((s) => s.trim()).filter(Boolean);
  const keyIndex = parseInt(kid, 10);
  const secret = secrets[keyIndex] || secrets[0];

  if (!secret) return false;

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
    const verifyPayload = parts.length === 2 ? `${kid}:${nonce}` : nonce;
    return crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(verifyPayload)
    );
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-correlation-id", correlationId);

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const withCorrelation = (res: any) => {
    if (res && res.headers) {
      res.headers.set("x-correlation-id", correlationId);
    }
    return res;
  };

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
        return withCorrelation(NextResponse.json(
          { error: "Internal Server Error: Missing auth secret." },
          { status: 500 }
        ));
      }

      if (!cookieToken || !headerToken) {
        return withCorrelation(NextResponse.json(
          { error: "CSRF token missing.", code: "CSRF_INVALID" },
          { status: 403 }
        ));
      }

      const isCookieValid = await validateCsrfToken(cookieToken, secret);
      const isHeaderValid = await validateCsrfToken(headerToken, secret);

      if (!isCookieValid || !isHeaderValid || !safeCompare(cookieToken, headerToken)) {
        return withCorrelation(NextResponse.json(
          { error: "CSRF token invalid.", code: "CSRF_INVALID" },
          { status: 403 }
        ));
      }
    }
  }

  // 2. Distributed Rate Limiting for public API requests
  if (isApiRequest && !pathname.startsWith("/api/internal/")) {
    const isRateLimitedEndpoint =
      pathname === "/api/listings" ||
      pathname.startsWith("/api/chat/") ||
      pathname.startsWith("/api/offers/") ||
      pathname === "/api/orders" ||
      pathname === "/api/cap-estimate" ||
      pathname === "/api/retail/refresh";

    if (isRateLimitedEndpoint) {
      const flyClientIp = request.headers.get("fly-client-ip");
      const clientIp = process.env.NODE_ENV === "production"
        ? (flyClientIp || "127.0.0.1")
        : (flyClientIp || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1");
      const key = `${clientIp}:${pathname}`;
      const internalSecret = process.env.NEXTAUTH_SECRET;

      if (!internalSecret) {
        return withCorrelation(NextResponse.json(
          { error: "Internal Server Error: Missing auth secret." },
          { status: 500 }
        ));
      }

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
          return withCorrelation(NextResponse.json(
            { error: "Too Many Requests.", code: "RATE_LIMIT_EXCEEDED" },
            { status: 429 }
          ));
        }
      } catch (err) {
        console.error("Failed to check rate limit (fail-closed protection triggered):", err);
        return withCorrelation(NextResponse.json(
          { error: "Service temporarily unavailable.", code: "RATE_LIMIT_SERVICE_FAILURE" },
          { status: 503 }
        ));
      }
    }
  }

  return withCorrelation(NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  }));
}

export const config = {
  matcher: "/api/:path*",
};
