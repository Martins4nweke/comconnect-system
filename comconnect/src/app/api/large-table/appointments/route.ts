import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { getScopedContext } from "@/lib/comconnect-core/access-scope";
import {
  getLargeTableParams,
  getNextCursor,
} from "@/lib/large-table/pagination";
import { applyCommonFilters, textSearchOr } from "@/lib/large-table/query";

function participantLabel(row: any) {
  const participant = row?.participants;

  return (
    participant?.metadata?.display_name ??
    `${participant?.first_name ?? ""} ${participant?.last_name ?? ""}`.trim() ??
    participant?.participant_code ??
    "—"
  );
}

export async function GET(req: NextRequest) {
  try {
    const context = await getScopedContext(req);
    const params = getLargeTableParams(req);

    let query = supabaseAdmin
      .from("appointments")
      .select(
        "*, participants(participant_code, phone_number, first_name, last_name, metadata)"
      )
      .eq("organisation_id", context.organisation_id)
      .order("start_at", { ascending: true })
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
      "title",
      "description",
      "location",
      "appointment_type",
      "status",
    ]);

    if (search) query = query.or(search);

    const { data, error } = await query;

    if (error) return fail(error.message, 500);

    const rows = (data ?? []).map((row: any) => ({
      ...row,
      participant_label: participantLabel(row),
      participant_code: row.participants?.participant_code ?? "—",
      participant_phone: row.participants?.phone_number ?? null,
      appointment_label: row.title ?? row.appointment_type ?? "Appointment",
      appointment_time_label: row.start_at ?? null,
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
    return fail(error?.message ?? "Failed to load appointments", 500);
  }
}