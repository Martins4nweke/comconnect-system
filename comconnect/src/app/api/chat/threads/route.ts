import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { verifyParticipantInProject } from "@/lib/research-care/module-access";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("project_id");
  const participantId = req.nextUrl.searchParams.get("participant_id");
  const threadId = req.nextUrl.searchParams.get("thread_id");

  /*
    Thread detail mode:
    Used by /chat/[threadId].
    In this mode, project_id is not required because the thread ID is already unique.
  */
  if (threadId) {
    const { data, error } = await supabaseAdmin
      .from("chat_threads")
      .select(
        "*, participants(participant_code, display_name, phone_number), chat_messages(*)"
      )
      .eq("id", threadId)
      .maybeSingle();

    if (error) return fail(error.message, 500);
    if (!data) return fail("Chat thread not found", 404);

    return ok([data]);
  }

  /*
    Thread list mode:
    Used by /chat table.
    In this mode, project_id is required so we do not load all projects.
  */
  if (!projectId) return fail("project_id is required");

  let query = supabaseAdmin
    .from("chat_threads")
    .select(
      "*, participants(participant_code, display_name, phone_number), chat_messages(*)"
    )
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  if (participantId) {
    query = query.eq("participant_id", participantId);
  }

  const { data, error } = await query;

  if (error) return fail(error.message, 500);

  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body?.project_id) return fail("project_id is required");
  if (!body?.participant_id) return fail("participant_id is required");

  try {
    const participant = await verifyParticipantInProject(
      body.participant_id,
      body.project_id
    );

    const { data, error } = await supabaseAdmin
      .from("chat_threads")
      .insert({
        organisation_id: participant.organisation_id,
        project_id: participant.project_id,
        participant_id: participant.id,
        subject: body.subject ?? null,
        status: body.status ?? "open",
        assigned_user_id: body.assigned_user_id ?? null,
        last_message_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    return ok(data, 201);
  } catch (error: any) {
    return fail(error.message ?? "Failed to create chat thread", 400);
  }
}