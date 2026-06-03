import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";

export async function GET(req: NextRequest) {
  const projectCode = req.nextUrl.searchParams.get("project_code");
  const channel = req.nextUrl.searchParams.get("channel");
  const status = req.nextUrl.searchParams.get("status");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 100);

  let projectId: string | null = null;

  if (projectCode) {
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("project_code", projectCode)
      .single();

    if (projectError || !project) {
      return fail("Project code not found", 404);
    }

    projectId = project.id;
  }

  let query = supabaseAdmin
    .from("communication_delivery_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));

  if (projectId) query = query.eq("project_id", projectId);
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
    const { data: participants, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("id, participant_code, phone_number, first_name, last_name, metadata")
      .in("id", participantIds);

    if (participantError) return fail(participantError.message, 500);

    participantMap = new Map(
      (participants ?? []).map((participant) => [participant.id, participant])
    );
  }

  const rows = (events ?? []).map((event) => ({
    ...event,
    participants: event.participant_id
      ? participantMap.get(event.participant_id) ?? null
      : null,
  }));

  return ok(rows);
}