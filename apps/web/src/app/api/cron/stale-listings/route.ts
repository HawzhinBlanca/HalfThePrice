import { NextRequest, NextResponse } from "next/server";
import { processStaleListings } from "@htp/database";
import { jsonError } from "@/lib/api";

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const summary = await processStaleListings();
    return NextResponse.json(summary);
  } catch {
    return jsonError("Stale listing processing failed.", 500);
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
