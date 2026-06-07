import { supabaseAdmin } from "@/lib/supabase/admin";

type ApiUsageRequestSource = "dashboard" | "external_api" | "webhook" | "system";

type ApiUsageChannel =
  | "app"
  | "push"
  | "sms"
  | "voice"
  | "whatsapp"
  | "email"
  | "webhook";

export type LogApiUsageParams = {
  organisationId: string;
  projectId?: string | null;
  apiKeyId?: string | null;

  endpoint: string;
  method: string;
  statusCode: number;
  durationMs?: number | null;

  requestSource?: ApiUsageRequestSource;
  channel?: ApiUsageChannel | null;
  paidChannel?: boolean;
  walletTransactionId?: string | null;

  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

export async function logApiUsage(params: LogApiUsageParams) {
  try {
    const organisationId = cleanText(params.organisationId);

    if (!organisationId) {
      return {
        ok: false as const,
        error: "organisationId is required for API usage logging.",
      };
    }

    const endpoint = cleanText(params.endpoint) || "unknown";
    const method = cleanText(params.method).toUpperCase() || "UNKNOWN";

    const statusCode = Number(params.statusCode);

    if (!Number.isFinite(statusCode)) {
      return {
        ok: false as const,
        error: "statusCode must be a valid number.",
      };
    }

    const durationMs =
      typeof params.durationMs === "number" && Number.isFinite(params.durationMs)
        ? Math.max(0, Math.round(params.durationMs))
        : null;

    const { error } = await supabaseAdmin.from("api_usage_logs").insert({
      organisation_id: organisationId,
      project_id: params.projectId || null,
      api_key_id: params.apiKeyId || null,

      endpoint,
      method,
      status_code: Math.round(statusCode),
      duration_ms: durationMs,

      request_source: params.requestSource || "dashboard",
      channel: params.channel || null,
      paid_channel: Boolean(params.paidChannel),
      wallet_transaction_id: params.walletTransactionId || null,

      error_message: params.errorMessage || null,
      metadata: params.metadata ?? {},
    });

    if (error) {
      return {
        ok: false as const,
        error: error.message,
      };
    }

    return {
      ok: true as const,
    };
  } catch (error: any) {
    return {
      ok: false as const,
      error: error?.message ?? "Failed to log API usage.",
    };
  }
}