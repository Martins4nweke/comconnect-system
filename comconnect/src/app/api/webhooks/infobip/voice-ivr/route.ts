import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function extractReports(body: any) {
  if (Array.isArray(body?.results)) return body.results;
  if (Array.isArray(body?.messages)) return body.messages;
  if (Array.isArray(body?.events)) return body.events;
  if (Array.isArray(body?.calls)) return body.calls;
  if (Array.isArray(body)) return body;
  return [body];
}

function extractProviderMessageId(report: any) {
  return (
    report?.messageId ??
    report?.messageID ??
    report?.callId ??
    report?.bulkId ??
    report?.id ??
    report?.call?.id ??
    report?.call?.callId ??
    null
  );
}

function extractPhone(report: any) {
  return (
    report?.from ??
    report?.to ??
    report?.destination ??
    report?.phoneNumber ??
    report?.msisdn ??
    report?.call?.from ??
    report?.call?.to ??
    null
  );
}

function extractDtmf(report: any) {
  return cleanText(
    report?.dtmf ??
      report?.digit ??
      report?.digits ??
      report?.input ??
      report?.userInput ??
      report?.collectedInput ??
      report?.collectedDigits ??
      report?.ivr?.dtmf ??
      report?.ivr?.input ??
      report?.ivr?.digits ??
      report?.event?.input ??
      report?.event?.digits ??
      report?.payload?.dtmf ??
      report?.payload?.input ??
      report?.payload?.digits
  );
}

function labelForDtmf(value: string) {
  if (value === "1") {
    return {
      title: "Voice IVR completed",
      summary: "Participant pressed 1 - Completed / understood.",
      priority: "normal",
      status: "resolved",
      response_code: "completed",
    };
  }

  if (value === "2") {
    return {
      title: "Voice IVR help request",
      summary: "Participant pressed 2 - Needs help.",
      priority: "high",
      status: "open",
      response_code: "needs_help",
    };
  }

  if (value === "3") {
    return {
      title: "Voice IVR callback request",
      summary: "Participant pressed 3 - Call me back.",
      priority: "high",
      status: "open",
      response_code: "callback_requested",
    };
  }

  if (value === "4") {
    return {
      title: "Voice IVR repeat requested",
      summary: "Participant pressed 4 - Repeat message requested.",
      priority: "normal",
      status: "open",
      response_code: "repeat_requested",
    };
  }

  return {
    title: "Voice IVR reply",
    summary: value
      ? `Participant pressed ${value}.`
      : "Participant IVR response received.",
    priority: "normal",
    status: "open",
    response_code: value ? `pressed_${value}` : "unknown",
  };
}

async function findParticipantId(report: any) {
  const providerMessageId = extractProviderMessageId(report);

  if (providerMessageId) {
    const { data: event } = await supabaseAdmin
      .from("communication_delivery_events")
      .select("participant_id")
      .eq("provider_message_id", providerMessageId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (event?.participant_id) return event.participant_id;
  }

  const phoneRaw = cleanText(extractPhone(report));
  const phoneDigits = phoneRaw.replace(/[^\d]/g, "");

  if (phoneDigits) {
    const { data: participant } = await supabaseAdmin
      .from("participants")
      .select("id")
      .or(`phone_number.eq.${phoneDigits},phone_number.eq.+${phoneDigits}`)
      .limit(1)
      .maybeSingle();

    if (participant?.id) return participant.id;
  }

  return null;
}

async function findContext(report: any) {
  const providerMessageId = extractProviderMessageId(report);

  if (providerMessageId) {
    const { data: event } = await supabaseAdmin
      .from("communication_delivery_events")
      .select("organisation_id, project_id, participant_id")
      .eq("provider_message_id", providerMessageId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (event) return event;
  }

  const participantId = await findParticipantId(report);

  if (participantId) {
    const { data: participant } = await supabaseAdmin
      .from("participants")
      .select("id, organisation_id, project_id")
      .eq("id", participantId)
      .maybeSingle();

    if (participant) {
      return {
        organisation_id: participant.organisation_id,
        project_id: participant.project_id,
        participant_id: participant.id,
      };
    }
  }

  return {
    organisation_id: null,
    project_id: null,
    participant_id: null,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body) return fail("Invalid Infobip voice IVR payload", 400);

  const reports = extractReports(body);
  const results: any[] = [];

  for (const report of reports) {
    const dtmf = extractDtmf(report);
    const providerMessageId = extractProviderMessageId(report);
    const context = await findContext(report);
    const mapped = labelForDtmf(dtmf);

    const { data: inboxItem, error: inboxError } = await supabaseAdmin
      .from("inbox_items")
      .insert({
        organisation_id: context.organisation_id,
        project_id: context.project_id,
        participant_id: context.participant_id,
        source_type: "voice_ivr_reply",
        source_id: providerMessageId,
        title: mapped.title,
        summary: mapped.summary,
        priority: mapped.priority,
        status: mapped.status,
      })
      .select("*")
      .single();

    if (inboxError) {
      results.push({
        ok: false,
        provider_message_id: providerMessageId,
        dtmf,
        error: inboxError.message,
        report,
      });

      continue;
    }

    results.push({
      ok: true,
      provider_message_id: providerMessageId,
      dtmf,
      response_code: mapped.response_code,
      inbox_item_id: inboxItem.id,
    });
  }

  return ok({
    received_count: reports.length,
    results,
  });
}