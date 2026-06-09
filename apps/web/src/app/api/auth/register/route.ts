import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@htp/database";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";

const REGISTER_RATE_LIMIT = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  role: z.enum(["BUYER", "SELLER"]).default("BUYER"),
  phone: z.string().optional(),
  governorate: z.string().optional(),
  legalName: z.string().optional(),
  displayName: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`register:${ip}`, REGISTER_RATE_LIMIT, REGISTER_WINDOW_MS);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later." },
      { status: 429 },
    );
  }

  try {
    const body: unknown = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        name: sanitizeText(data.name, 100),
        role: data.role,
        phone: data.phone ? sanitizeText(data.phone, 20) : undefined,
        ...(data.role === "SELLER" && data.governorate
          ? {
              sellerProfile: {
                create: {
                  legalName: sanitizeText(data.legalName ?? data.name, 200),
                  displayName: sanitizeText(data.displayName ?? data.name, 100),
                  governorate: sanitizeText(data.governorate, 100),
                  kycStatus: "PENDING",
                },
              },
            }
          : {}),
      },
    });

    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
