import {
  getAfricaTalkingConfig,
  normaliseMsisdn,
  toFormBody,
} from "./africastalking";

type VoicePayload = {
  to: string;
  message?: string;
  reason?: string;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normaliseInfobipMsisdn(value: string) {
  return cleanText(value)
    .replace(/[^\d+]/g, "")
    .replace(/^\+/, "");
}

function getInfobipVoiceConfig() {
  const baseUrl = cleanText(process.env.INFOBIP_BASE_URL);
  const apiKey = cleanText(process.env.INFOBIP_API_KEY);
  const voiceFrom = cleanText(process.env.INFOBIP_VOICE_FROM);

  const voiceUrl =
    cleanText(process.env.INFOBIP_VOICE_URL) ||
    `${baseUrl.replace(/\/+$/, "")}/tts/3/advanced`;

  const notifyUrl = cleanText(process.env.INFOBIP_VOICE_NOTIFY_URL);
  const language = cleanText(process.env.INFOBIP_VOICE_LANGUAGE) || "en";
  const voiceName = cleanText(process.env.INFOBIP_VOICE_NAME) || "Joanna";
  const voiceGender = cleanText(process.env.INFOBIP_VOICE_GENDER) || "female";

  if (!baseUrl && !voiceUrl) {
    throw new Error("INFOBIP_BASE_URL or INFOBIP_VOICE_URL is required");
  }

  if (!apiKey) {
    throw new Error("INFOBIP_API_KEY is required");
  }

  if (!voiceFrom) {
    throw new Error("INFOBIP_VOICE_FROM is required");
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    voiceFrom,
    voiceUrl,
    notifyUrl,
    language,
    voiceName,
    voiceGender,
  };
}

function getInfobipVoiceError(json: any, status: number) {
  return (
    json?.requestError?.serviceException?.text ??
    json?.requestError?.serviceException?.messageId ??
    json?.requestError?.serviceException?.validationErrors?.[0]?.message ??
    json?.messages?.[0]?.status?.description ??
    json?.messages?.[0]?.status?.name ??
    json?.error ??
    json?.message ??
    json?.description ??
    `Infobip voice failed: ${status}`
  );
}

function extractInfobipVoiceMessageId(json: any) {
  return (
    json?.messages?.[0]?.messageId ??
    json?.bulkId ??
    json?.callId ??
    json?.messageId ??
    json?.calls?.[0]?.callId ??
    null
  );
}

function extractInfobipVoiceBulkId(json: any) {
  return json?.bulkId ?? null;
}

function extractInfobipVoiceStatus(json: any) {
  return (
    json?.messages?.[0]?.status?.groupName ??
    json?.messages?.[0]?.status?.name ??
    json?.status?.groupName ??
    json?.status?.name ??
    json?.status ??
    null
  );
}

function infobipVoiceStatusIsFailure(status: unknown) {
  const text = cleanText(status).toUpperCase();

  return (
    text.includes("REJECT") ||
    text.includes("UNDELIVER") ||
    text.includes("EXPIRED") ||
    text.includes("FAILED") ||
    text.includes("ERROR")
  );
}

export async function startVoiceCall(payload: VoicePayload) {
  const provider = cleanText(
    process.env.VOICE_PROVIDER || "disabled"
  ).toLowerCase();

  if (provider === "disabled") {
    return {
      ok: false,
      provider,
      status: "skipped",
      error: "Voice provider disabled",
      response: null,
    };
  }

  if (provider === "africastalking") {
    try {
      const config = getAfricaTalkingConfig();

      if (!config.voiceFrom) {
        return {
          ok: false,
          provider,
          status: "failed",
          error: "AFRICASTALKING_VOICE_FROM is required for voice calls",
          response: null,
        };
      }

      const to = normaliseMsisdn(payload.to);

      const form = toFormBody({
        username: config.username,
        from: config.voiceFrom,
        to,
        callStartUrl: config.callStartUrl,
        callNotificationUrl: config.callNotificationUrl,
      });

      const res = await fetch(config.voiceUrl, {
        method: "POST",
        headers: {
          apiKey: config.apiKey,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });

      const json = await res.json().catch(() => null);
      const entry = json?.entries?.[0] ?? json?.Entries?.[0] ?? null;
      const providerStatus = entry?.status ?? json?.status;

      const ok =
        res.ok &&
        !String(providerStatus || "").toLowerCase().includes("error");

      return {
        ok,
        provider,
        status: ok ? "sent" : "failed",
        provider_message_id: entry?.sessionId ?? json?.sessionId ?? null,
        provider_bulk_id: null,
        error: ok
          ? null
          : entry?.errorMessage ??
            json?.errorMessage ??
            `Africa's Talking voice failed: ${res.status}`,
        response: json,
      };
    } catch (error: any) {
      return {
        ok: false,
        provider,
        status: "failed",
        provider_message_id: null,
        provider_bulk_id: null,
        error: error.message ?? "Africa's Talking voice failed",
        response: null,
      };
    }
  }

  if (provider === "infobip") {
    try {
      const config = getInfobipVoiceConfig();
      const to = normaliseInfobipMsisdn(payload.to);

      const text =
        cleanText(payload.message) ||
        cleanText(payload.reason) ||
        "You have a ComConnect voice message.";

      const messageBody: Record<string, any> = {
        destinations: [
          {
            to,
          },
        ],
        from: config.voiceFrom,
        language: config.language,
        text,
        voice: {
          name: config.voiceName,
          gender: config.voiceGender,
        },
      };

      if (config.notifyUrl) {
        messageBody.notifyUrl = config.notifyUrl;
      }

      const res = await fetch(config.voiceUrl, {
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
      const providerStatus = extractInfobipVoiceStatus(json);

      const ok = res.ok && !infobipVoiceStatusIsFailure(providerStatus);

      return {
        ok,
        provider,
        status: ok ? "sent" : "failed",
        provider_message_id: extractInfobipVoiceMessageId(json),
        provider_bulk_id: extractInfobipVoiceBulkId(json),
        error: ok ? null : getInfobipVoiceError(json, res.status),
        response: json,
      };
    } catch (error: any) {
      return {
        ok: false,
        provider,
        status: "failed",
        provider_message_id: null,
        provider_bulk_id: null,
        error: error.message ?? "Infobip voice failed",
        response: null,
      };
    }
  }

  if (provider === "generic_http") {
    if (!process.env.GENERIC_VOICE_URL) {
      return {
        ok: false,
        provider,
        status: "failed",
        error: "GENERIC_VOICE_URL missing",
        response: null,
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (process.env.GENERIC_VOICE_AUTH_HEADER) {
      headers.Authorization = process.env.GENERIC_VOICE_AUTH_HEADER;
    }

    const res = await fetch(process.env.GENERIC_VOICE_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: payload.to,
        message: payload.message,
        reason: payload.reason,
      }),
    });

    const json = await res.json().catch(() => null);

    return {
      ok: res.ok,
      provider,
      status: res.ok ? "sent" : "failed",
      provider_message_id: json?.id ?? json?.callId ?? null,
      provider_bulk_id: null,
      error: res.ok ? null : json?.error ?? `Voice call failed: ${res.status}`,
      response: json,
    };
  }

  return {
    ok: false,
    provider,
    status: "failed",
    provider_message_id: null,
    provider_bulk_id: null,
    error: `Unsupported voice provider: ${provider}`,
    response: null,
  };
}