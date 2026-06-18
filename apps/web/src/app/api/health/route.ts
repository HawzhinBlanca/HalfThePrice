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

  try {
    const centrifugoUrl = process.env.CENTRIFUGO_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${centrifugoUrl}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      checks.centrifugo = { ok: true, message: "Centrifugo reachable" };
    } else {
      checks.centrifugo = { ok: false, message: `Centrifugo status: ${res.status}` };
    }
  } catch (error) {
    checks.centrifugo = {
      ok: false,
      message: error instanceof Error ? error.message : "Centrifugo unreachable",
    };
  }

  const ok = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      status: ok ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: ok ? 200 : 503 },
  );
}
