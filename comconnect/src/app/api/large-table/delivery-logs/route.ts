import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { getScopedContext } from "@/lib/comconnect-core/access-scope";
import {
  getLargeTableParams,
  getNextCursor,
} from "@/lib/large-table/pagination";
import { applyCommonFilters, textSearchOr } from "@/lib/large-table/query";

function participantDisplayName(participant: any, fallback?: string | null) {
  if (!participant) return fallback ?? "—";

  const fullName = `${participant.first_name ?? ""} ${
    participant.last_name ?? ""
  }`.trim();

  return (
    participant.metadata?.display_name ??
    fullName ??
    participant.participant_code ??
    participant.phone_number ??
    fallback ??
    "—"
  );
}

export async function GET(req: NextRequest) {
  try {
    const context = await getScopedContext(req);
    const params = getLargeTableParams(req);

    let query = supabaseAdmin
      .from("communication_delivery_events")
      .select("*")
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
      "channel",
      "source_type",
      "provider",
      "provider_message_id",
      "provider_status",
      "status",
      "failure_reason",
      "error_message",
      "phone_number",
    ]);

    if (search) query = query.or(search);

    const { data: events, error } = await query;

    if (error) return fail(error.message, 500);

    const participantIds = Array.from(
      new Set(
        (events ?? [])
          .map((event) => event.participant_id)
          .filter(Boolean)
      )
    );

    let participantMap = new Map<string, any>();

    if (participantIds.length > 0) {
      let participantQuery = supabaseAdmin
        .from("participants")
        .select(
          "id, participant_code, phone_number, first_name, last_name, metadata"
        )
        .eq("organisation_id", context.organisation_id)
        .in("id", participantIds);

      if (context.active_project_id) {
        participantQuery = participantQuery.eq(
          "project_id",
          context.active_project_id
        );
      } else if (context.allowed_project_ids.length > 0) {
        participantQuery = participantQuery.in(
          "project_id",
          context.allowed_project_ids
        );
      } else {
        participantQuery = participantQuery.eq(
          "project_id",
          "__no_project_access__"
        );
      }

      const { data: participants, error: participantError } =
        await participantQuery;

      if (participantError) return fail(participantError.message, 500);

      participantMap = new Map(
        (participants ?? []).map((participant) => [
          participant.id,
          participant,
        ])
      );
    }

    const rows = (events ?? []).map((row: any) => {
      const participant = row.participant_id
        ? participantMap.get(row.participant_id) ?? null
        : null;

      return {
        ...row,
        participants: participant,
        participant_label: participantDisplayName(
          participant,
          row.phone_number
        ),
        participant_code: participant?.participant_code ?? null,
        participant_phone_number:
          participant?.phone_number ?? row.phone_number ?? null,
        channel_label: row.channel ?? "—",
        status_label: row.status ?? "—",
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
    return fail(error?.message ?? "Failed to load delivery logs", 500);
  }
}