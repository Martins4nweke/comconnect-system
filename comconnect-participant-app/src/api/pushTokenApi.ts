import { apiFetch } from "./client";

export async function registerPushToken(payload: {
  push_token: string;
  push_provider: "expo" | string;
}) {
  return apiFetch("/api/participant-app/devices/push-token", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}