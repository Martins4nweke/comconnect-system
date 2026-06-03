import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normaliseStatus(value: unknown) {
  const text = cleanText(value).toUpperCase();

  if (text.includes("DELIVERED")) return "delivered";
  if (text.includes("PENDING")) return "sent";
  if (text.includes("EXPIRED")) return "expired";
  if (text.includes("UNDELIVERABLE")) return "undeliverable";
  if (text.includes("REJECTED")) return "failed";
  if (text.includes("FAILED")) return "failed";

  return text ? text.toLowerCase() : "unknown";
}

function extractReports(body: any) {
  if (Array.isArray(body?.results)) return body.results;
  if (Array.isArray(body?.messages)) return body.messages;
  if (Array.isArray(body)) return body;
  return [body];
}

function extractMessageId(report: any) {
  return (
    report?.messageId ??
    report?.messageID ??
    report?.id ??
    null
  );
}

function extractStatus(report: any) {
  return (
    report?.status?.name ??
    report?.status?.groupName ??
    report?.status ??
    report?.deliveryStatus ??
    null
  );
}

function extractReason(report: any) {
  return (
    report?.status?.description ??
    report?.error?.description ??
    report?.error?.message ??
    report?.reason ??
    report?.description ??
    null
  );
}

function extractCode(report: any) {
  return (
    report?.status?.id ??
    report?.status?.code ??
    report?.error?.id ??
    report?.error?.code ??
    report?.code ??
    null
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body) return fail("Invalid Infobip SMS delivery payload", 400);

  const reports = extractReports(body);
  const updates: any[] = [];

  for (const report of reports) {
    const providerMessageId = extractMessageId(report);
    const providerStatus = extractStatus(report);
    const finalStatus = normaliseStatus(providerStatus);
    const reason = extractReason(report);
    const code = extractCode(report);

    if (!providerMessageId) {
      updates.push({
        matched: false,
        reason: "Missing provider message id",
        report,
      });
      continue;
    }

    await supabaseAdmin
      .from("sms_logs")
      .update({
        status: finalStatus,
        error_message: finalStatus === "delivered" ? null : reason ?? providerStatus,
        metadata: {
          infobip_final_status: finalStatus,
          infobip_provider_status: providerStatus,
          infobip_failure_reason: reason,
          infobip_error_code: code,
          infobip_delivery_report: report,
        },
      })
      .eq("provider_message_id", providerMessageId);

    const { data: events, error: findError } = await supabaseAdmin
      .from("communication_delivery_events")
      .select("id")
      .eq("provider_message_id", providerMessageId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (findError) {
      updates.push({
        provider_message_id: providerMessageId,
        matched: false,
        error: findError.message,
      });
      continue;
    }

    const eventIds = (events ?? []).map((item) => item.id);

    if (eventIds.length > 0) {
      const { error: updateEventError } = await supabaseAdmin
        .from("communication_delivery_events")
        .update({
          status: finalStatus,
          provider_status: providerStatus,
          failure_reason: finalStatus === "delivered" ? null : reason ?? providerStatus,
          error_message: finalStatus === "delivered" ? null : reason ?? providerStatus,
          response_payload: {
            delivery_report: report,
            error_code: code,
          },
        })
        .in("id", eventIds);

      updates.push({
        provider_message_id: providerMessageId,
        matched: !updateEventError,
        final_status: finalStatus,
        provider_status: providerStatus,
        reason,
        error_code: code,
        error: updateEventError?.message ?? null,
      });
    } else {
      updates.push({
        provider_message_id: providerMessageId,
        matched: false,
        final_status: finalStatus,
        provider_status: providerStatus,
        reason,
        error_code: code,
      });
    }
  }

  return ok({
    received_count: reports.length,
    updates,
  });
}