import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { getLargeTableParams, getNextCursor } from "@/lib/large-table/pagination";
import { applyCommonFilters, textSearchOr } from "@/lib/large-table/query";

const PAGE_SIZE = 50;

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function extractChatMessageType(payload: any) {
  const value = cleanText(
    payload?.message_type ??
      payload?.media_type ??
      payload?.media?.message_type ??
      payload?.media?.media_type
  ).toLowerCase();

  if (value === "audio") return "audio";
  if (value === "voice") return "audio";
  if (value === "voice_note") return "audio";
  if (value === "image") return "image";
  if (value === "photo") return "image";
  if (value === "video") return "video";
  if (value === "file") return "file";

  return "text";
}

function extractChatMediaUrl(payload: any) {
  return cleanText(
    payload?.media_url ??
      payload?.url ??
      payload?.media?.media_url ??
      payload?.media?.url
  );
}

function labelForChatPayload(payload: any) {
  const messageType = extractChatMessageType(payload);

  if (messageType === "audio") return "Voice note received";
  if (messageType === "image") return "Image received";
  if (messageType === "video") return "Video received";
  if (messageType === "file") return "File received";

  return "Chat message";
}

function moduleForChatPayload(payload: any) {
  const messageType = extractChatMessageType(payload);

  if (["audio", "image", "video", "file"].includes(messageType)) {
    return "Chat media";
  }

  return "Chat";
}

function labelForSourceType(sourceType?: string | null, payload?: any) {
  switch (sourceType) {
    case "app_message_reply":
      return "Message reply";
    case "chat_message":
      return labelForChatPayload(payload);
    case "questionnaire_response":
      return "Questionnaire completed";
    case "appointment_response":
      return "Appointment response";
    case "health_observation":
      return "Health check-in";
    case "help_request":
      return "Help request";
    case "referral_note":
      return "Referral response";
    case "education_response":
      return "Education feedback";
    case "sms_reply":
      return "SMS reply";
    case "whatsapp_reply":
      return "WhatsApp reply";
    case "voice_ivr_reply":
      return "Voice IVR reply";
    case "voice_recording_reply":
      return "Voice recording reply";
    default:
      return sourceType ? sourceType.replaceAll("_", " ") : "Inbox item";
  }
}

function moduleForSourceType(sourceType?: string | null, payload?: any) {
  switch (sourceType) {
    case "app_message_reply":
    case "sms_reply":
    case "whatsapp_reply":
      return "Core communication";
    case "chat_message":
      return moduleForChatPayload(payload);
    case "questionnaire_response":
      return "Questionnaires";
    case "appointment_response":
      return "Appointments";
    case "health_observation":
      return "Health check-ins";
    case "help_request":
      return "Help requests";
    case "referral_note":
      return "Referrals";
    case "education_response":
      return "Education";
    case "voice_ivr_reply":
    case "voice_recording_reply":
      return "Voice";
    default:
      return "Inbox";
  }
}

function defaultHrefForSource(
  sourceType?: string | null,
  sourceId?: string | null
) {
  if (!sourceType || !sourceId) return "/inbox";

  switch (sourceType) {
    case "help_request":
      return `/help-requests/${sourceId}`;
    case "appointment_response":
      return "/appointments";
    case "questionnaire_response":
      return "/questionnaires";
    case "health_observation":
      return "/health-checkins";
    case "referral_note":
      return "/referrals";
    case "chat_message":
      return "/chat";
    case "app_message_reply":
    case "sms_reply":
    case "whatsapp_reply":
    case "voice_ivr_reply":
    case "voice_recording_reply":
      return "/inbox";
    default:
      return "/inbox";
  }
}

export async function GET(req: NextRequest) {
  const params = getLargeTableParams(req);
  const limit = PAGE_SIZE;

  let query = supabaseAdmin
    .from("inbox_items")
    .select("*, participants(participant_code, display_name, phone_number)")
    .order("created_at", { ascending: false })
    .limit(limit);

  query = applyCommonFilters(query, params);

  const search = textSearchOr(params.q, [
    "title",
    "summary",
    "source_type",
    "priority",
    "status",
  ]);

  if (search) query = query.or(search);

  const { data, error } = await query;
  if (error) return fail(error.message, 500);

  const rows = data ?? [];

  const chatMessageIds = rows
    .filter((row: any) => row.source_type === "chat_message" && row.source_id)
    .map((row: any) => row.source_id);

  let chatMessageMap = new Map<
    string,
    {
      id: string;
      thread_id: string | null;
      payload: any;
      message_text?: string | null;
    }
  >();

  if (chatMessageIds.length > 0) {
    const { data: chatMessages } = await supabaseAdmin
      .from("chat_messages")
      .select("id, thread_id, message_text, payload")
      .in("id", chatMessageIds);

    chatMessageMap = new Map(
      (chatMessages ?? []).map((message: any) => [
        message.id,
        {
          id: message.id,
          thread_id: message.thread_id,
          payload: message.payload ?? {},
          message_text: message.message_text,
        },
      ])
    );
  }

  const enrichedRows = rows.map((row: any) => {
    const sourceType = row.source_type ?? null;
    const sourceId = row.source_id ?? null;

    const chatMessage =
      sourceType === "chat_message" && sourceId
        ? chatMessageMap.get(sourceId)
        : null;

    const chatPayload = chatMessage?.payload ?? null;
    const chatThreadId = chatMessage?.thread_id ?? null;

    const actionHref =
      sourceType === "chat_message" && chatThreadId
        ? `/chat/${chatThreadId}`
        : defaultHrefForSource(sourceType, sourceId);

    const mediaType =
      sourceType === "chat_message" ? extractChatMessageType(chatPayload) : null;

    const mediaUrl =
      sourceType === "chat_message" ? extractChatMediaUrl(chatPayload) : "";

    const responseType = labelForSourceType(sourceType, chatPayload);
    const responseModule = moduleForSourceType(sourceType, chatPayload);

    const summary =
      sourceType === "chat_message" && mediaType && mediaType !== "text"
        ? row.summary || chatMessage?.message_text || responseType
        : row.summary;

    return {
      ...row,
      summary,
      response_type: responseType,
      response_module: responseModule,
      action_href: actionHref,
      participant_label:
        row.participants?.display_name ??
        row.participants?.participant_code ??
        "—",

      chat_thread_id: chatThreadId,
      chat_message_type: mediaType,
      chat_media_url: mediaUrl || null,
      has_media:
        sourceType === "chat_message" &&
        Boolean(mediaType && mediaType !== "text"),
    };
  });

  return ok({
    rows: enrichedRows,
    limit,
    next_cursor: getNextCursor(enrichedRows),
  });
}