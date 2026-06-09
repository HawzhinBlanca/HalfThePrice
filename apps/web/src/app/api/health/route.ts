import { NextResponse } from "next/server";
import { prisma } from "@htp/database";
import { checkMeilisearchHealth } from "@htp/search";
import { checkMinioHealth } from "@htp/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; message: string }> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true, message: "PostgreSQL reachable" };
  } catch (error) {
    checks.database = {
      ok: false,
      message: error instanceof Error ? error.message : "Database unreachable",
    };
  }

  checks.meilisearch = await checkMeilisearchHealth();
  checks.minio = await checkMinioHealth();

  const ok = Object.values(checks).every((c) => c.ok || c.message.includes("not configured"));

  return NextResponse.json(
    {
      status: ok ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: ok ? 200 : 503 },
  );
}
