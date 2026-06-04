import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { getScopedContext } from "@/lib/comconnect-core/access-scope";
import { getLargeTableParams, getNextCursor } from "@/lib/large-table/pagination";
import { applyCommonFilters, textSearchOr } from "@/lib/large-table/query";

export async function GET(req: NextRequest) {
  try {
    const context = await getScopedContext(req);
    const params = getLargeTableParams(req);

    let query = supabaseAdmin
      .from("communication_schedules")
      .select("*, participants(participant_code, phone_number, metadata)")
      .eq("organisation_id", context.organisation_id)
      .order("scheduled_for", { ascending: false })
      .limit(params.limit);

    if (context.active_project_id) {
      query = query.eq("project_id", context.active_project_id);
    } else if (context.allowed_project_ids.length > 0) {
      query = query.in("project_id", context.allowed_project_ids);
    } else {
      query = query.eq("project_id", "__no_project_access__");
    }

    query = applyCommonFilters(query, params);

    const search = textSearchOr(params.q, [
      "participant_code",
      "message_code",
      "message_title",
      "source_type",
      "resolved_channel",
      "status",
      "provider",
    ]);

    if (search) query = query.or(search);

    const { data, error } = await query;

    if (error) return fail(error.message, 500);

    const rows = (data ?? []).map((row: any) => ({
      ...row,
      participant_label:
        row.participants?.metadata?.display_name ??
        row.participants?.participant_code ??
        row.participant_code ??
        "—",
      phone_number: row.participants?.phone_number ?? null,
      channel_label: row.resolved_channel ?? row.requested_channel ?? "app",
    }));

    return ok({
      rows,
      limit: params.limit,
      next_cursor: getNextCursor(rows),
      scope: {
        organisation_id: context.organisation_id,
        project_id: context.active_project_id,
      },
    });
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load schedules", 500);
  }
}