import { apiFetch, apiUpload } from "./client";
import type { ParticipantConfig, OfflineQueueItem } from "../types";

export type LoginPayload = {
  organisation_slug?: string;
  project_code: string;
  participant_code: string;
  phone_number: string;
  device: {
    device_id: string;
    platform: string;
    app_version: string;
    push_token?: string;
  };
};

export async function loginParticipant(payload: LoginPayload) {
  return apiFetch<{
    session_token: string;
    session_id: string;
    config: ParticipantConfig;
  }>(
    "/api/participant-app/login",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    false
  );
}

export async function logoutParticipant() {
  return apiFetch<{ logged_out: boolean }>("/api/participant-app/logout", {
    method: "POST",
  });
}

export async function getMe() {
  return apiFetch<ParticipantConfig>("/api/participant-app/me");
}

export async function syncPull(lastSyncedAt?: string | null) {
  return apiFetch<any>("/api/participant-app/sync/pull", {
    method: "POST",
    body: JSON.stringify({
      last_synced_at: lastSyncedAt ?? null,
    }),
  });
}

export async function syncPush(items: OfflineQueueItem[]) {
  return apiFetch<any>("/api/participant-app/sync/push", {
    method: "POST",
    body: JSON.stringify({
      items,
    }),
  });
}

export async function markMessageOpened(message_id: string) {
  return apiFetch<any>("/api/participant-app/messages/open", {
    method: "POST",
    body: JSON.stringify({
      message_id,
      local_id: `open:${message_id}:${Date.now()}`,
    }),
  });
}

export async function replyToMessage(message_id: string, reply_text: string) {
  return apiFetch<any>("/api/participant-app/messages/reply", {
    method: "POST",
    body: JSON.stringify({
      message_id,
      reply_text,
      local_id: `reply:${message_id}:${Date.now()}`,
    }),
  });
}

export async function submitEducationProgress(
  payload: Record<string, unknown>
) {
  return apiFetch<any>("/api/participant-app/education/progress", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function submitHelpRequest(payload: Record<string, unknown>) {
  return apiFetch<any>("/api/participant-app/help/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendChatMessage(payload: Record<string, unknown>) {
  return apiFetch<any>("/api/participant-app/chat/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendChatMedia(payload: {
  file_uri: string;
  file_name: string;
  mime_type: string;
  media_type: "audio" | "video" | "image";
  thread_id?: string | null;
  message_text?: string;
  local_id?: string;
}) {
  const formData = new FormData();

  formData.append("file", {
    uri: payload.file_uri,
    name: payload.file_name,
    type: payload.mime_type,
  } as any);

  formData.append("media_type", payload.media_type);
  formData.append("message_text", payload.message_text ?? "");
  formData.append("local_id", payload.local_id ?? `chat-media:${Date.now()}`);

  if (payload.thread_id) {
    formData.append("thread_id", payload.thread_id);
  }

  return apiUpload<any>("/api/participant-app/chat/upload", formData);
}

export async function markChatRead(
  payload?: {
    thread_id?: string | null;
    local_id?: string;
    read_at?: string;
    created_offline_at?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const readAt = payload?.read_at ?? new Date().toISOString();

  return apiFetch<any>("/api/participant-app/chat/mark-read", {
    method: "POST",
    body: JSON.stringify({
      thread_id: payload?.thread_id ?? null,
      local_id: payload?.local_id ?? `chat-read:${Date.now()}`,
      read_at: readAt,
      created_offline_at: payload?.created_offline_at ?? null,
      metadata: payload?.metadata ?? {},
    }),
  });
}