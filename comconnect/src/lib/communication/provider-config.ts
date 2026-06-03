export function getPushProvider() {
  return process.env.PUSH_PROVIDER || "disabled";
}

export function getSmsProvider() {
  return process.env.SMS_PROVIDER || "disabled";
}

export function getVoiceProvider() {
  return process.env.VOICE_PROVIDER || "disabled";
}

export function requireCronSecret(request: Request) {
  const expected = process.env.COMCONNECT_CRON_SECRET;
  const received = request.headers.get("x-comconnect-cron-secret");

  if (!expected) {
    return { ok: false, error: "COMCONNECT_CRON_SECRET is not configured" };
  }

  if (received !== expected) {
    return { ok: false, error: "Invalid cron secret" };
  }

  return { ok: true };
}
