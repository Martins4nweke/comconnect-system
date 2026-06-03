import { supabaseAdmin } from "@/lib/supabase/admin";

export async function queuePushForParticipant({
  project_id,
  participant_id,
  title,
  body,
  data,
  scheduled_for,
}: {
  project_id: string;
  participant_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  scheduled_for?: string;
}) {
  const { data: participant, error: participantError } = await supabaseAdmin
    .from("participants")
    .select("id, organisation_id, project_id")
    .eq("id", participant_id)
    .eq("project_id", project_id)
    .maybeSingle();

  if (participantError || !participant) {
    throw new Error("Participant not found for this project");
  }

  const { data: device } = await supabaseAdmin
    .from("participant_devices")
    .select("id")
    .eq("participant_id", participant_id)
    .eq("is_active", true)
    .eq("notifications_enabled", true)
    .order("push_token_updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: queued, error } = await supabaseAdmin
    .from("push_notification_queue")
    .insert({
      organisation_id: participant.organisation_id,
      project_id,
      participant_id,
      device_id: device?.id ?? null,
      title,
      body,
      data: data ?? {},
      status: "pending",
      scheduled_for: scheduled_for ?? new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return queued;
}
