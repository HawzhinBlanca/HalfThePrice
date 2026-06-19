import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { UserRole } from "@htp/contracts";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

const COOKIE_NAME = "htp_session";

function getJwtSecrets(): Uint8Array[] {
  const secretString = process.env.NEXTAUTH_SECRET;
  if (!secretString) {
    throw new Error("NEXTAUTH_SECRET environment variable is missing.");
  }
  const encoder = new TextEncoder();
  return secretString.split(",").map((s) => s.trim()).filter(Boolean).map((s) => encoder.encode(s));
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  const secrets = getJwtSecrets();
  const primarySecret = secrets[0];
  if (!primarySecret) {
    throw new Error("NEXTAUTH_SECRET is empty.");
  }
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(primarySecret);
}

export async function verifySessionToken(
  token: string,
): Promise<SessionUser | null> {
  const secrets = getJwtSecrets();
  
  for (const secret of secrets) {
    try {
      const { payload } = await jwtVerify(token, secret);
      if (
        typeof payload.id !== "string" ||
        typeof payload.email !== "string" ||
        typeof payload.name !== "string" ||
        typeof payload.role !== "string"
      ) {
        return null;
      }
      return {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        role: payload.role as UserRole,
      };
    } catch {
      continue; // Try the next secret key
    }
  }
  return null;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
