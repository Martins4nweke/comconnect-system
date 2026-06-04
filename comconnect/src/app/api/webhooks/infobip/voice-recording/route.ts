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
  if (Array.isArray(body?.recordings)) return body.recordings;
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
    report?.recording?.callId ??
    report?.payload?.messageId ??
    report?.payload?.callId ??
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
    report?.recording?.from ??
    report?.recording?.to ??
    report?.payload?.from ??
    report?.payload?.to ??
    null
  );
}

function extractRecordingUrl(report: any) {
  return cleanText(
    report?.recordingUrl ??
      report?.recording_url ??
      report?.url ??
      report?.mediaUrl ??
      report?.media_url ??
      report?.fileUrl ??
      report?.file_url ??
      report?.audioUrl ??
      report?.audio_url ??
      report?.recording?.url ??
      report?.recording?.recordingUrl ??
      report?.recording?.mediaUrl ??
      report?.payload?.recordingUrl ??
      report?.payload?.mediaUrl ??
      report?.payload?.url
  );
}

function extractRecordingId(report: any) {
  return (
    report?.recordingId ??
    report?.recording_id ??
    report?.recording?.id ??
    report?.payload?.recordingId ??
    null
  );
}

function extractDuration(report: any) {
  return (
    report?.duration ??
    report?.durationSeconds ??
    report?.duration_seconds ??
    report?.recording?.duration ??
    report?.recording?.durationSeconds ??
    report?.payload?.duration ??
    null
  );
}

function extractTranscript(report: any) {
  return cleanText(
    report?.transcript ??
      report?.transcription ??
      report?.text ??
      report?.speechText ??
      report?.speech_text ??
      report?.recording?.transcript ??
      report?.payload?.transcript
  );
}

function extractQuestionType(report: any) {
  const value = cleanText(
    report?.question_type ??
      report?.questionType ??
      report?.metadata?.question_type ??
      report?.payload?.question_type
  ).toLowerCase();

  if (value) return value;

  return "voice_response";
}

function labelForQuestionType(questionType: string) {
  if (questionType.includes("bp") || questionType.includes("blood_pressure")) {
    return {
      title: "Voice BP reply",
      summary: "Participant left a spoken blood pressure response.",
      priority: "normal",
    };
  }

  if (
    questionType.includes("med") ||
    questionType.includes("adherence") ||
    questionType.includes("medicine")
  ) {
    return {
      title: "Voice medication reply",
      summary: "Participant left a spoken medication adherence response.",
      priority: "normal",
    };
  }

  if (
    questionType.includes("help") ||
    questionType.includes("symptom") ||
    questionType.includes("concern")
  ) {
    return {
      title: "Voice concern reply",
      summary: "Participant left a spoken concern or help response.",
      priority: "high",
    };
  }

  return {
    title: "Voice recording reply",
    summary: "Participant left a spoken response.",
    priority: "normal",
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

  if (!body) return fail("Invalid Infobip voice recording payload", 400);

  const reports = extractReports(body);
  const results: any[] = [];

  for (const report of reports) {
    const providerMessageId = extractProviderMessageId(report);
    const recordingId = extractRecordingId(report);
    const recordingUrl = extractRecordingUrl(report);
    const duration = extractDuration(report);
    const transcript = extractTranscript(report);
    const questionType = extractQuestionType(report);
    const context = await findContext(report);
    const label = labelForQuestionType(questionType);

    const summaryParts = [
      label.summary,
      recordingUrl ? "Recording link received." : "Recording metadata received.",
      transcript ? `Transcript: ${transcript}` : null,
    ].filter(Boolean);

    const { data: inboxItem, error: inboxError } = await supabaseAdmin
      .from("inbox_items")
      .insert({
        organisation_id: context.organisation_id,
        project_id: context.project_id,
        participant_id: context.participant_id,
        source_type: "voice_recording_reply",
        source_id: recordingId ?? providerMessageId,
        title: label.title,
        summary: summaryParts.join(" "),
        priority: label.priority,
        status: "open",
      })
      .select("*")
      .single();

    if (inboxError) {
      results.push({
        ok: false,
        provider_message_id: providerMessageId,
        recording_id: recordingId,
        recording_url: recordingUrl,
        error: inboxError.message,
        report,
      });

      continue;
    }

    results.push({
      ok: true,
      provider_message_id: providerMessageId,
      recording_id: recordingId,
      recording_url: recordingUrl,
      duration,
      transcript,
      question_type: questionType,
      inbox_item_id: inboxItem.id,
    });
  }

  return ok({
    received_count: reports.length,
    results,
  });
}