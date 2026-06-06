import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { getScopedContext } from "@/lib/comconnect-core/access-scope";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    const channel = cleanText(req.nextUrl.searchParams.get("channel"));
    const status = cleanText(req.nextUrl.searchParams.get("status"));
    const participantId = cleanText(
      req.nextUrl.searchParams.get("participant_id")
    );
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 100);

    let query = supabaseAdmin
      .from("communication_delivery_events")
      .select("*")
      .eq("organisation_id", context.organisation_id)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 200));

    if (context.active_project_id) {
      query = query.eq("project_id", context.active_project_id);
    } else if (context.allowed_project_ids.length > 0) {
      query = query.in("project_id", context.allowed_project_ids);
    } else {
      query = query.eq("project_id", "__no_project_access__");
    }

    if (participantId) query = query.eq("participant_id", participantId);
    if (channel) query = query.eq("channel", channel);
    if (status) query = query.eq("status", status);

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

    const rows = (events ?? []).map((event) => ({
      ...event,
      participants: event.participant_id
        ? participantMap.get(event.participant_id) ?? null
        : null,
    }));

    return ok(rows);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load delivery logs", 500);
  }
}