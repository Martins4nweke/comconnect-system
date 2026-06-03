import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ParticipantAppSessionContext } from "./types";

export async function verifyParticipantMessageAccess(
  context: ParticipantAppSessionContext,
  messageId: string
) {
  const { data, error } = await supabaseAdmin
    .from("app_messages")
    .select("id, organisation_id, project_id, participant_id, status")
    .eq("id", messageId)
    .eq("organisation_id", context.organisation_id)
    .eq("project_id", context.project_id)
    .eq("participant_id", context.participant_id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify message access: ${error.message}`);
  }

  return data ?? null;
}
