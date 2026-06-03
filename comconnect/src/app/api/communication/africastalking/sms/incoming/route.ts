import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normaliseMsisdn } from "@/lib/communication/africastalking";

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return fail("Invalid incoming SMS payload");

  const incomingFrom = String(form.get("from") ?? "");
  const to = String(form.get("to") ?? "");
  const text = String(form.get("text") ?? "");
  const date = String(form.get("date") ?? "");
  const id = String(form.get("id") ?? "");
  const normalisedFrom = incomingFrom ? normaliseMsisdn(incomingFrom) : "";

  let participant = null;

  if (normalisedFrom) {
    const { data } = await supabaseAdmin
      .from("participants")
      .select("id, organisation_id, project_id, phone_number")
      .or(`phone_number.eq.${normalisedFrom},phone_number.eq.${incomingFrom}`)
      .maybeSingle();

    participant = data;
  }

  if (participant) {
    await supabaseAdmin.from("app_message_replies").insert({
      organisation_id: participant.organisation_id,
      project_id: participant.project_id,
      participant_id: participant.id,
      local_id: `sms-in:${id || Date.now()}`,
      reply_text: text,
      reply_payload: { from: incomingFrom, normalisedFrom, to, text, date, id, channel: "sms" },
      synced_at: new Date().toISOString(),
    });

    await supabaseAdmin.from("inbox_items").insert({
      organisation_id: participant.organisation_id,
      project_id: participant.project_id,
      participant_id: participant.id,
      source_type: "incoming_sms",
      title: "Incoming SMS reply",
      summary: text,
      priority: "normal",
      status: "open",
    });
  }

  return ok({ received: true, matched_participant: Boolean(participant) });
}
