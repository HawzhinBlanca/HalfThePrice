import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { CSRF_COOKIE, CSRF_HEADER } from "./constants";

export { CSRF_COOKIE, CSRF_HEADER };

function getSecrets(): string[] {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET environment variable is missing.");
  }
  return secret.split(",").map((s) => s.trim()).filter(Boolean);
}

export function generateCsrfToken(): string {
  const nonce = randomBytes(16).toString("hex");
  const secrets = getSecrets();
  const primarySecret = secrets[0] || "fallback";
  const kid = "0"; // Primary key version
  const signature = createHmac("sha256", primarySecret)
    .update(`${kid}:${nonce}`)
    .digest("hex");
  return `${kid}:${nonce}.${signature}`;
}

export function validateCsrfToken(token: string): boolean {
  const parts = token.split(":");
  let kid = "0";
  let body = "";

  if (parts.length === 2) {
    kid = parts[0] || "0";
    body = parts[1] || "";
  } else {
    // Legacy fallback (no kid prefix)
    body = token;
  }

  const [nonce, signature] = body.split(".");
  if (!nonce || !signature) return false;

  const secrets = getSecrets();
  const keyIndex = parseInt(kid, 10);
  const secret = secrets[keyIndex] || secrets[0]; // Fallback to primary if out of range

  if (!secret) return false;

  const expected = createHmac("sha256", secret)
    .update(parts.length === 2 ? `${kid}:${nonce}` : nonce)
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
