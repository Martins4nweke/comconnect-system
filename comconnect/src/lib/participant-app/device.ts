import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  ParticipantAppDeviceInput,
  ParticipantAppSessionContext,
} from "./types";

function normalisePushToken(value: unknown) {
  const token = String(value ?? "").trim();

  if (!token) return null;

  if (!token.startsWith("ExponentPushToken[")) {
    return null;
  }

  return token;
}

export async function registerParticipantDevice(
  context: Omit<ParticipantAppSessionContext, "session_id">,
  device: ParticipantAppDeviceInput
) {
  if (!device.device_id) return null;

  const pushToken = normalisePushToken(device.push_token);
  const now = new Date().toISOString();

  const metadata =
    device.metadata && typeof device.metadata === "object"
      ? device.metadata
      : {};

  const payload = {
    organisation_id: context.organisation_id,
    project_id: context.project_id,
    participant_id: context.participant_id,
    device_id: device.device_id,
    platform: device.platform ?? "unknown",
    app_version: device.app_version ?? null,

    push_token: pushToken,
    push_provider: pushToken ? device.push_provider ?? "expo" : null,
    notifications_enabled:
      typeof device.notifications_enabled === "boolean"
        ? device.notifications_enabled
        : Boolean(pushToken),

    low_data_mode:
      typeof device.low_data_mode === "boolean"
        ? device.low_data_mode
        : true,

    last_seen_at: now,
    status: "active",

    metadata: {
      ...metadata,
      push_token_updated_at: pushToken ? now : null,
      push_provider: pushToken ? device.push_provider ?? "expo" : null,
    },
  };

  const { data, error } = await supabaseAdmin
    .from("participant_devices")
    .upsert(payload, { onConflict: "participant_id,device_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to register device: ${error.message}`);
  }

  return data;
}