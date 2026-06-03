import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return fail("Invalid callback payload");

  const providerMessageId = String(form.get("id") ?? form.get("messageId") ?? "");
  const status = String(form.get("status") ?? "unknown");
  const phoneNumber = String(form.get("phoneNumber") ?? form.get("phone") ?? "");
  const networkCode = String(form.get("networkCode") ?? "");
  const failureReason = String(form.get("failureReason") ?? "");

  if (providerMessageId) {
    await supabaseAdmin
      .from("sms_logs")
      .update({
        status: status.toLowerCase().includes("success") ? "sent" : status.toLowerCase(),
        error_message: failureReason || null,
      })
      .eq("provider_message_id", providerMessageId);
  }

  await supabaseAdmin.from("communication_provider_health").insert({
    provider: "africastalking",
    channel: "sms",
    status: "callback_received",
    response_payload: {
      providerMessageId,
      status,
      phoneNumber,
      networkCode,
      failureReason,
    },
  });

  return ok({ received: true });
}
