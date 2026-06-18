import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@htp/contracts";
import { getSession, type SessionUser } from "./auth";
import { verifyCsrfRequest } from "./csrf";
import {
  getErrorMessage,
  resolveLocale,
  type ApiErrorCode,
} from "./errors";

export async function requireAuth(
  roles?: UserRole[],
): Promise<{ user: SessionUser } | NextResponse> {
  const user = await getSession();
  if (!user) {
    return localizedError("UNAUTHORIZED", 401);
  }
  if (roles && !roles.includes(user.role)) {
    return localizedError("FORBIDDEN", 403);
  }
  return { user };
}

export function localizedError(
  code: ApiErrorCode,
  status = 400,
  request?: NextRequest,
  details?: Record<string, string[]>,
) {
  const locale = request
    ? resolveLocale(
        request.headers.get("x-locale"),
        request.cookies.get("htp_locale")?.value,
      )
    : "en";

  return NextResponse.json(
    {
      error: getErrorMessage(code, locale),
      code,
      ...(details ? { details } : {}),
    },
    { status },
  );
}

export function jsonError(
  message: string,
  status = 400,
  code?: ApiErrorCode,
) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status });
}

export function requireCsrf(request: NextRequest): NextResponse | null {
  if (!verifyCsrfRequest(request)) {
    return localizedError("CSRF_INVALID", 403, request);
  }
  return null;
}

export async function requireMutatingAuth(
  request: NextRequest,
  roles?: UserRole[],
): Promise<{ user: SessionUser } | NextResponse> {
  const csrfError = requireCsrf(request);
  if (csrfError) return csrfError;
  return requireAuth(roles);
}

import { correlationStorage } from "@htp/database";
import { randomUUID } from "node:crypto";

export function withCorrelation<T>(
  request: NextRequest,
  fn: () => Promise<T>,
): Promise<T> {
  const correlationId =
    request.headers.get("x-correlation-id") ||
    request.headers.get("x-request-id") ||
    randomUUID();
  return correlationStorage.run({ correlationId }, fn);
}

