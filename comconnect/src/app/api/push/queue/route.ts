import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { verifyParticipantInProject } from "@/lib/research-care/module-access";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("project_id");
  if (!projectId) return fail("project_id is required");

  const { data, error } = await supabaseAdmin
    .from("push_notification_queue")
    .select("*")
    .eq("project_id", projectId)
    .order("scheduled_for", { ascending: true })
    .limit(200);

  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.project_id) return fail("project_id is required");
  if (!body?.participant_id) return fail("participant_id is required");

  try {
    const participant = await verifyParticipantInProject(body.participant_id, body.project_id);

    const { data, error } = await supabaseAdmin
      .from("push_notification_queue")
      .insert({
        organisation_id: participant.organisation_id,
        project_id: participant.project_id,
        participant_id: participant.id,
        title: body.title ?? "ComConnect",
        body: body.body ?? "You have a new ComConnect update.",
        data: body.data ?? {},
        status: "pending",
        scheduled_for: body.scheduled_for ?? new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);
    return ok(data, 201);
  } catch (error: any) {
    return fail(error.message ?? "Failed to queue push notification", 400);
  }
}
