import { supabaseAdmin } from "@/lib/supabase/admin";

type PushPayload = {
  participant_id: string;
  project_id: string;
  organisation_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export async function sendParticipantPushNotification(payload: PushPayload) {
  const { data: devices, error } = await supabaseAdmin
    .from("participant_devices")
    .select("id, push_token, push_provider, notifications_enabled, status")
    .eq("participant_id", payload.participant_id)
    .eq("project_id", payload.project_id)
    .eq("organisation_id", payload.organisation_id)
    .eq("status", "active")
    .eq("notifications_enabled", true)
    .not("push_token", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  const tokens = (devices ?? [])
    .map((device) => device.push_token)
    .filter((token): token is string =>
      Boolean(token && token.startsWith("ExponentPushToken["))
    );

  if (tokens.length === 0) {
    return {
      sent: 0,
      skipped: true,
      reason: "no_active_push_tokens",
    };
  }

  const messages = tokens.map((token) => ({
    to: token,
    sound: null,
    title: payload.title,
    body: payload.body,
    data: {
      project_id: payload.project_id,
      participant_id: payload.participant_id,
      ...payload.data,
    },
    priority: "default",
  }));

  let sent = 0;
  const results: unknown[] = [];

  for (const batch of chunkArray(messages, 100)) {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        result?.errors?.[0]?.message ??
          result?.message ??
          "Expo push notification request failed"
      );
    }

    sent += batch.length;
    results.push(result);
  }

  await supabaseAdmin.from("participant_app_events").insert({
    organisation_id: payload.organisation_id,
    project_id: payload.project_id,
    participant_id: payload.participant_id,
    local_id: `push:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    event_type: "push_notification_sent",
    payload: {
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      token_count: tokens.length,
      result_count: results.length,
    },
  });

  return {
    sent,
    skipped: false,
    results,
  };
}