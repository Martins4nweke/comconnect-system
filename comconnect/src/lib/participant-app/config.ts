import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ParticipantAppSessionContext } from "./types";

export async function getParticipantAppConfig(context: ParticipantAppSessionContext) {
  const [{ data: participant, error: participantError }, { data: project, error: projectError }, { data: organisation, error: organisationError }, { data: modules }, { data: channelSettings }] =
    await Promise.all([
      supabaseAdmin
        .from("participants")
        .select("id, participant_code, phone_number, first_name, last_name, display_name, preferred_language, status, app_access_enabled, metadata")
        .eq("id", context.participant_id)
        .single(),
      supabaseAdmin
        .from("projects")
        .select("id, name, project_code, description, status, default_language, app_access_enabled, settings")
        .eq("id", context.project_id)
        .single(),
      supabaseAdmin
        .from("organisations")
        .select("id, name, slug, logo_url, primary_colour, support_email, support_phone, settings")
        .eq("id", context.organisation_id)
        .single(),
      supabaseAdmin
        .from("project_modules")
        .select("module_code, module_name, enabled, settings")
        .eq("project_id", context.project_id)
        .order("module_name"),
      supabaseAdmin
        .from("project_channel_settings")
        .select("*")
        .eq("project_id", context.project_id)
        .maybeSingle(),
    ]);

  if (participantError) {
    throw new Error(`Failed to fetch participant: ${participantError.message}`);
  }
  if (projectError) {
    throw new Error(`Failed to fetch project: ${projectError.message}`);
  }
  if (organisationError) {
    throw new Error(`Failed to fetch organisation: ${organisationError.message}`);
  }

  return {
    organisation,
    project,
    participant,
    modules: modules ?? [],
    channel_settings: channelSettings ?? null,
    app_defaults: {
      low_data_mode: true,
      media_download: "wifi_only",
      safe_push_notifications: true,
      default_channel_flow: ["app", "sms", "voice"],
      whatsapp_optional: Boolean(channelSettings?.whatsapp_enabled),
    },
    server_time: new Date().toISOString(),
  };
}
