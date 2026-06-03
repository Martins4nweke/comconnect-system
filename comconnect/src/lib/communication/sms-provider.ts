import {
  getAfricaTalkingConfig,
  normaliseMsisdn,
  toFormBody,
} from "./africastalking";

type SmsPayload = {
  to: string;
  message: string;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function getInfobipConfig() {
  const baseUrl = cleanText(process.env.INFOBIP_BASE_URL);
  const apiKey = cleanText(process.env.INFOBIP_API_KEY);
  const smsFrom = cleanText(process.env.INFOBIP_SMS_FROM);
  const notifyUrl = cleanText(process.env.INFOBIP_SMS_NOTIFY_URL);

  if (!baseUrl) throw new Error("INFOBIP_BASE_URL is required");
  if (!apiKey) throw new Error("INFOBIP_API_KEY is required");
  if (!smsFrom) throw new Error("INFOBIP_SMS_FROM is required");

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    smsFrom,
    notifyUrl,
  };
}

function normaliseInfobipMsisdn(value: string) {
  return cleanText(value)
    .replace(/[^\d+]/g, "")
    .replace(/^\+/, "");
}

function getInfobipError(json: any, status: number) {
  return (
    json?.requestError?.serviceException?.text ??
    json?.requestError?.serviceException?.messageId ??
    json?.requestError?.serviceException?.validationErrors?.[0]?.message ??
    json?.messages?.[0]?.status?.description ??
    json?.messages?.[0]?.status?.name ??
    `Infobip SMS failed: ${status}`
  );
}

function infobipStatusIsFailure(statusGroup: unknown, statusName: unknown) {
  const group = cleanText(statusGroup).toUpperCase();
  const name = cleanText(statusName).toUpperCase();

  return (
    group === "REJECTED" ||
    group === "UNDELIVERABLE" ||
    group === "EXPIRED" ||
    name.includes("REJECT") ||
    name.includes("UNDELIVER") ||
    name.includes("EXPIRED")
  );
}

export async function sendSms(payload: SmsPayload) {
  const provider = cleanText(
    process.env.SMS_PROVIDER || "disabled"
  ).toLowerCase();

  if (provider === "disabled") {
    return {
      ok: false,
      provider,
      status: "skipped",
      error: "SMS provider disabled",
      response: null,
    };
  }

  if (provider === "africastalking") {
    try {
      const config = getAfricaTalkingConfig();
      const to = normaliseMsisdn(payload.to);

      const form = toFormBody({
        username: config.username,
        to,
        message: payload.message,
        from: config.smsFrom,
        enqueue: "1",
      });

      const res = await fetch(config.smsUrl, {
        method: "POST",
        headers: {
          apiKey: config.apiKey,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });

      const json = await res.json().catch(() => null);
      const recipient = json?.SMSMessageData?.Recipients?.[0];
      const providerStatus =
        recipient?.status || json?.SMSMessageData?.Message;

      const ok =
        res.ok &&
        !String(providerStatus || "").toLowerCase().includes("invalid");

      return {
        ok,
        provider,
        status: ok ? "sent" : "failed",
        provider_message_id: recipient?.messageId ?? null,
        provider_bulk_id: null,
        error: ok
          ? null
          : recipient?.status ??
            json?.errorMessage ??
            `Africa's Talking SMS failed: ${res.status}`,
        response: json,
      };
    } catch (error: any) {
      return {
        ok: false,
        provider,
        status: "failed",
        provider_message_id: null,
        provider_bulk_id: null,
        error: error.message ?? "Africa's Talking SMS failed",
        response: null,
      };
    }
  }

  if (provider === "infobip") {
    try {
      const config = getInfobipConfig();
      const to = normaliseInfobipMsisdn(payload.to);

      const messageBody: Record<string, any> = {
        from: config.smsFrom,
        destinations: [
          {
            to,
          },
        ],
        text: payload.message,
      };

      if (config.notifyUrl) {
        messageBody.notifyUrl = config.notifyUrl;
      }

      const res = await fetch(`${config.baseUrl}/sms/2/text/advanced`, {
        method: "POST",
        headers: {
          Authorization: `App ${config.apiKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [messageBody],
        }),
      });

      const json = await res.json().catch(() => null);
      const message = json?.messages?.[0];
      const statusGroup = message?.status?.groupName;
      const statusName = message?.status?.name;

      const ok =
        res.ok && !infobipStatusIsFailure(statusGroup, statusName);

      return {
        ok,
        provider,
        status: ok ? "sent" : "failed",
        provider_message_id: message?.messageId ?? null,
        provider_bulk_id: json?.bulkId ?? null,
        error: ok ? null : getInfobipError(json, res.status),
        response: json,
      };
    } catch (error: any) {
      return {
        ok: false,
        provider,
        status: "failed",
        provider_message_id: null,
        provider_bulk_id: null,
        error: error.message ?? "Infobip SMS failed",
        response: null,
      };
    }
  }

  if (provider === "generic_http") {
    if (!process.env.GENERIC_SMS_URL) {
      return {
        ok: false,
        provider,
        status: "failed",
        error: "GENERIC_SMS_URL missing",
        response: null,
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (process.env.GENERIC_SMS_AUTH_HEADER) {
      headers.Authorization = process.env.GENERIC_SMS_AUTH_HEADER;
    }

    const res = await fetch(process.env.GENERIC_SMS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: payload.to,
        message: payload.message,
      }),
    });

    const json = await res.json().catch(() => null);

    return {
      ok: res.ok,
      provider,
      status: res.ok ? "sent" : "failed",
      provider_message_id: json?.id ?? json?.messageId ?? null,
      provider_bulk_id: null,
      error: res.ok ? null : json?.error ?? `SMS failed: ${res.status}`,
      response: json,
    };
  }

  return {
    ok: false,
    provider,
    status: "failed",
    provider_message_id: null,
    provider_bulk_id: null,
    error: `Unsupported SMS provider: ${provider}`,
    response: null,
  };
}