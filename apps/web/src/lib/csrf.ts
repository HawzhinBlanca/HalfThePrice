import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { CSRF_COOKIE, CSRF_HEADER } from "./constants";

export { CSRF_COOKIE, CSRF_HEADER };

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET environment variable is missing.");
  }
  return secret;
}

export function generateCsrfToken(): string {
  const nonce = randomBytes(16).toString("hex");
  const signature = createHmac("sha256", getSecret())
    .update(nonce)
    .digest("hex");
  return `${nonce}.${signature}`;
}

export function validateCsrfToken(token: string): boolean {
  const [nonce, signature] = token.split(".");
  if (!nonce || !signature) return false;

  const expected = createHmac("sha256", getSecret())
    .update(nonce)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function setCsrfCookie(): Promise<string> {
  const token = generateCsrfToken();
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return token;
}

export async function getCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CSRF_COOKIE)?.value;
  if (existing && validateCsrfToken(existing)) {
    return existing;
  }
  return setCsrfCookie();
}

export function verifyCsrfRequest(request: NextRequest): boolean {
  if (process.env.CSRF_DISABLED === "true") return true;

  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) return false;
  if (!validateCsrfToken(cookieToken) || !validateCsrfToken(headerToken)) {
    return false;
  }

  return cookieToken === headerToken;
}
