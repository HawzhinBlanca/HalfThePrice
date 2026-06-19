import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@htp/database";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { withCorrelation } from "@/lib/api";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const LOGIN_RATE_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  return withCorrelation(request, async () => {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`login:${ip}`, LOGIN_RATE_LIMIT, LOGIN_WINDOW_MS);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
        },
      );
    }

    try {
      const body: unknown = await request.json();
      const parsed = loginSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
      }

      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email.toLowerCase() },
      });

      if (!user || user.status !== "ACTIVE") {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }

      const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }

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
      return NextResponse.json({ error: "Login failed" }, { status: 500 });
    }
  });
}
