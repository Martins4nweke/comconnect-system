import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return fail("Invalid voice event payload");

  const sessionId = String(form.get("sessionId") ?? "");
  const status = String(form.get("status") ?? "");
  const callerNumber = String(form.get("callerNumber") ?? "");
  const destinationNumber = String(form.get("destinationNumber") ?? "");
  const duration = String(form.get("durationInSeconds") ?? "");

  if (sessionId) {
    await supabaseAdmin.from("communication_provider_health").insert({
      provider: "africastalking",
      channel: "voice",
      status: status || "event_received",
      response_payload: {
        sessionId,
        status,
        callerNumber,
        destinationNumber,
        duration,
      },
    });
  }

  return ok({ received: true });
}
