import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { getLargeTableParams, getNextCursor } from "@/lib/large-table/pagination";
import { applyCommonFilters, textSearchOr } from "@/lib/large-table/query";

const PAGE_SIZE = 50;

function labelForSourceType(sourceType?: string | null) {
  switch (sourceType) {
    case "app_message_reply":
      return "Message reply";
    case "chat_message":
      return "Chat message";
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
    default:
      return sourceType ? sourceType.replaceAll("_", " ") : "Inbox item";
  }
}

function moduleForSourceType(sourceType?: string | null) {
  switch (sourceType) {
    case "app_message_reply":
    case "sms_reply":
    case "whatsapp_reply":
      return "Core communication";
    case "chat_message":
      return "Chat";
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
    default:
      return "Inbox";
  }
}

function defaultHrefForSource(sourceType?: string | null, sourceId?: string | null) {
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

  let chatThreadMap = new Map<string, string>();

  if (chatMessageIds.length > 0) {
    const { data: chatMessages } = await supabaseAdmin
      .from("chat_messages")
      .select("id, thread_id, payload")
      .in("id", chatMessageIds);

    chatThreadMap = new Map(
      (chatMessages ?? []).map((message: any) => [
        message.id,
        message.thread_id,
      ])
    );
  }

  const enrichedRows = rows.map((row: any) => {
    const sourceType = row.source_type ?? null;
    const sourceId = row.source_id ?? null;

    const chatThreadId =
      sourceType === "chat_message" && sourceId
        ? chatThreadMap.get(sourceId)
        : null;

    const actionHref =
      sourceType === "chat_message" && chatThreadId
        ? `/chat/${chatThreadId}`
        : defaultHrefForSource(sourceType, sourceId);

    return {
      ...row,
      response_type: labelForSourceType(sourceType),
      response_module: moduleForSourceType(sourceType),
      action_href: actionHref,
      participant_label:
        row.participants?.display_name ??
        row.participants?.participant_code ??
        "—",
    };
  });

  return ok({
    rows: enrichedRows,
    limit,
    next_cursor: getNextCursor(enrichedRows),
  });
}