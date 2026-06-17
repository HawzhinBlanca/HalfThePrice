import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { requireCsrf } from "@/lib/api";

export async function POST(request: NextRequest) {
  const csrfError = requireCsrf(request);
  if (csrfError) return csrfError;

  await clearSessionCookie();
  return NextResponse.redirect(new URL("/", process.env.NEXTAUTH_URL ?? "http://localhost:3000"));
}
