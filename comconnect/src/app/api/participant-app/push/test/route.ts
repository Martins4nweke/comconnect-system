import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendParticipantPushNotification } from "@/lib/participant-app/notifications/push";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const participantId = body?.participant_id
    ? String(body.participant_id)
    : null;

  if (!participantId) {
    return fail("participant_id is required");
  }

  const { data: participant, error } = await supabaseAdmin
    .from("participants")
    .select("id, organisation_id, project_id, participant_code")
    .eq("id", participantId)
    .maybeSingle();

  if (error) {
    return fail(error.message, 500);
  }

  if (!participant) {
    return fail("Participant not found", 404);
  }

  const result = await sendParticipantPushNotification({
    organisation_id: participant.organisation_id,
    project_id: participant.project_id,
    participant_id: participant.id,
    title: "ComConnect test",
    body: "This is a test notification from ComConnect.",
    data: {
      type: "test_push",
      screen: "home",
      participant_code: participant.participant_code,
    },
  });

  return ok({
    participant_id: participant.id,
    participant_code: participant.participant_code,
    result,
  });
}