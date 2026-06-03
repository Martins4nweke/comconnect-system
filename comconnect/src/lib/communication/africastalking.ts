export function getAfricaTalkingConfig() {
  const username = process.env.AFRICASTALKING_USERNAME;
  const apiKey = process.env.AFRICASTALKING_API_KEY;

  if (!username || !apiKey) {
    throw new Error("AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY are required");
  }

  return {
    username,
    apiKey,
    smsFrom: process.env.AFRICASTALKING_SMS_FROM || undefined,
    voiceFrom: process.env.AFRICASTALKING_VOICE_FROM || undefined,
    smsUrl: process.env.AFRICASTALKING_SMS_URL || "https://api.africastalking.com/version1/messaging",
    voiceUrl: process.env.AFRICASTALKING_VOICE_URL || "https://voice.africastalking.com/call",
    callStartUrl: process.env.AFRICASTALKING_CALL_START_URL || undefined,
    callNotificationUrl: process.env.AFRICASTALKING_CALL_NOTIFICATION_URL || undefined,
  };
}

export function toFormBody(values: Record<string, string | number | boolean | undefined | null>) {
  const body = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    body.append(key, String(value));
  }

  return body;
}

export function normaliseMsisdn(phone: string) {
  const value = String(phone || "").trim();
  if (!value) throw new Error("Phone number is required");

  if (value.startsWith("+")) return value;

  // South Africa convenience: 0731234567 -> +27731234567
  if (value.startsWith("0") && value.length === 10) {
    return `+27${value.slice(1)}`;
  }

  // Otherwise assume user supplied international number without +
  if (/^[1-9]\d{7,14}$/.test(value)) {
    return `+${value}`;
  }

  return value;
}
