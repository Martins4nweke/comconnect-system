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
      .from("participants")
      .select("*, projects(name, project_code), organisations(name)")
      .eq("organisation_id", context.organisation_id)
      .order("created_at", { ascending: false })
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
      "phone_number",
      "first_name",
      "last_name",
    ]);

    if (search) query = query.or(search);

    const { data, error } = await query;

    if (error) return fail(error.message, 500);

    const rows = (data ?? []).map((row: any) => ({
      ...row,
      participant_label:
        row.metadata?.display_name ??
        [row.first_name, row.last_name].filter(Boolean).join(" ") ??
        row.participant_code,
      project_label:
        row.projects?.name ??
        row.projects?.project_code ??
        "—",
      organisation_label: row.organisations?.name ?? "—",
      preferred_channel:
        row.metadata?.preferred_channel ??
        "app",
      whatsapp_number:
        row.metadata?.whatsapp_number ??
        null,
      email:
        row.metadata?.email ??
        null,
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
    return fail(error?.message ?? "Failed to load participants", 500);
  }
}