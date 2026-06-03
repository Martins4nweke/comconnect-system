import { NextRequest } from "next/server";

export function getLargeTableParams(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limitRaw = Number(sp.get("limit") ?? 50);
  const limit = Math.min(Math.max(limitRaw || 50, 1), 200);

  return {
    projectId: sp.get("project_id"),
    organisationId: sp.get("organisation_id"),
    q: sp.get("q"),
    status: sp.get("status"),
    priority: sp.get("priority"),
    cursor: sp.get("cursor"),
    limit,
  };
}

export function getNextCursor<T extends { created_at?: string; id?: string }>(rows: T[]) {
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1];
  return last.created_at ?? last.id ?? null;
}
