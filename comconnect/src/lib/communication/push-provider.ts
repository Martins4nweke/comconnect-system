type PushPayload = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function sendPushNotification(payload: PushPayload) {
  const provider = process.env.PUSH_PROVIDER || "disabled";

  if (provider === "disabled") {
    return {
      ok: false,
      provider,
      status: "skipped",
      error: "Push provider disabled",
      response: null,
    };
  }

  if (provider !== "expo") {
    return {
      ok: false,
      provider,
      status: "failed",
      error: `Unsupported push provider: ${provider}`,
      response: null,
    };
  }

  const endpoint = process.env.EXPO_PUSH_API_URL || "https://exp.host/--/api/v2/push/send";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (process.env.EXPO_PUSH_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_PUSH_ACCESS_TOKEN}`;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      to: payload.to,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: "default",
      priority: "high",
    }),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    return {
      ok: false,
      provider,
      status: "failed",
      error: json?.errors?.[0]?.message || `Push failed: ${res.status}`,
      response: json,
    };
  }

  return {
    ok: true,
    provider,
    status: "sent",
    provider_message_id: json?.data?.id ?? null,
    response: json,
  };
}
