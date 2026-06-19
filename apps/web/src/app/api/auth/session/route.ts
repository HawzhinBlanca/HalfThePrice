import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/auth";
import { withCorrelation } from "@/lib/api";

export async function POST(request: NextRequest) {
  return withCorrelation(request, async () => {
    await clearSessionCookie();
    return NextResponse.json({ success: true });
  });
}

export async function GET(request: NextRequest) {
  return withCorrelation(request, async () => {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ user: null });
    }
    return NextResponse.json({ user });
  });
}
