import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { requireCsrf, withCorrelation } from "@/lib/api";

export async function POST(request: NextRequest) {
  return withCorrelation(request, async () => {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    await clearSessionCookie();
    return NextResponse.redirect(new URL("/", process.env.NEXTAUTH_URL ?? "http://localhost:3000"));
  });
}
