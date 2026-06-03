import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { getLargeTableParams, getNextCursor } from "@/lib/large-table/pagination";
import { applyCommonFilters, textSearchOr } from "@/lib/large-table/query";

export async function GET(req: NextRequest) {
  const params = getLargeTableParams(req);

  let query = supabaseAdmin
    .from("communication_schedules")
    .select("*, participants(participant_code, phone_number, metadata)")
    .order("scheduled_for", { ascending: false })
    .limit(params.limit);

  query = applyCommonFilters(query, params);

  const search = textSearchOr(params.q, [
    "participant_code",
    "message_code",
    "message_title",
    "source_type",
    "resolved_channel",
  ]);

  if (search) query = query.or(search);

  const { data, error } = await query;

  if (error) return fail(error.message, 500);

  return ok({
    rows: data ?? [],
    limit: params.limit,
    next_cursor: getNextCursor(data ?? []),
  });
}