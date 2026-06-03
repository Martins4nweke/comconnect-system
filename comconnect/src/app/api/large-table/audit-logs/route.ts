import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { getLargeTableParams, getNextCursor } from "@/lib/large-table/pagination";

export async function GET(req: NextRequest) {
  const params = getLargeTableParams(req);

  let query = supabaseAdmin
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(params.limit);

  if (params.projectId) query = query.eq("project_id", params.projectId);
  if (params.organisationId) query = query.eq("organisation_id", params.organisationId);
  if (params.cursor) query = query.lt("created_at", params.cursor);
  if (params.q) query = query.or(`action.ilike.%${params.q}%,entity_type.ilike.%${params.q}%,actor_label.ilike.%${params.q}%`);

  const { data, error } = await query;
  if (error) return fail(error.message, 500);

  return ok({
    rows: data ?? [],
    limit: params.limit,
    next_cursor: getNextCursor(data ?? []),
  });
}
