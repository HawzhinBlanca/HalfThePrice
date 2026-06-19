import { NextRequest, NextResponse } from "next/server";
import { getCsrfToken } from "@/lib/csrf";
import { withCorrelation } from "@/lib/api";

export async function GET(request: NextRequest) {
  return withCorrelation(request, async () => {
    const token = await getCsrfToken();
    return NextResponse.json({ token });
  });
}
