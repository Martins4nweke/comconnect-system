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

function text(value: unknown, max = 90) {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  return raw.length > max ? `${raw.slice(0, max)}…` : raw;
}

export async function GET(req: NextRequest) {
  try {
    const context = await getScopedContext(req);
    const params = getLargeTableParams(req);

    let query = supabaseAdmin
      .from("push_notification_queue")
      .select(
        "*, participants(participant_code, first_name, last_name, phone_number, metadata)"
      )
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
      "title",
      "body",
      "status",
      "error_message",
    ]);

    if (search) query = query.or(search);

    const { data, error } = await query;

    if (error) return fail(error.message, 500);

    const rows = (data ?? []).map((row: any) => {
      const safeRow = { ...row };

      /*
        Privacy rule:
        never expose raw push tokens or device secrets to the frontend table.
      */
      delete safeRow.push_token;
      delete safeRow.device_token;
      delete safeRow.expo_push_token;

      return {
        ...safeRow,
        participant_label: participantLabel(row),
        participant_code: row.participants?.participant_code ?? "—",
        participant_phone: row.participants?.phone_number ?? null,
        push_title_label: text(row.title, 70),
        push_body_preview: text(row.body, 110),
        push_status_label: row.status ?? "pending",
      };
    });

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
    return fail(error?.message ?? "Failed to load push queue", 500);
  }
}