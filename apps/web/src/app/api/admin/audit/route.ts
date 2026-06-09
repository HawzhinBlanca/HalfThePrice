import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@htp/database";
import { requireAuth } from "@/lib/api";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const objectType = searchParams.get("objectType") ?? undefined;
  const action = searchParams.get("action") ?? undefined;

  const where = {
    ...(objectType ? { objectType } : {}),
    ...(action ? { action } : {}),
  };

  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.auditEvent.count({ where }),
  ]);

  return NextResponse.json({
    data: events,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
