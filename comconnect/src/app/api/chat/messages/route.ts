import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { sendParticipantPushNotification } from "@/lib/participant-app/notifications/push";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normaliseSenderType(value: unknown) {
  const senderType = cleanText(value).toLowerCase();

  if (senderType === "participant") return "participant";
  if (senderType === "staff") return "staff";
  if (senderType === "admin") return "admin";

  return "staff";
}

function normalisePayload(value: unknown, messageText: string) {
  const payload =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, any>)
      : {};

  return {
    ...payload,
    message_type: payload.message_type ?? "text",
    message_text: payload.message_text ?? messageText,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body) {
    return fail("Invalid chat message payload", 400);
  }

  const threadId = cleanText(body.thread_id);
  const messageText = cleanText(body.message_text);
  const senderType = normaliseSenderType(body.sender_type);

  if (!threadId) {
    return fail("thread_id is required", 400);
  }

  if (!messageText) {
    return fail("message_text is required", 400);
  }

  const { data: thread, error: threadError } = await supabaseAdmin
    .from("chat_threads")
    .select("id, organisation_id, project_id, participant_id, subject, status")
    .eq("id", threadId)
    .maybeSingle();

  if (threadError) {
    return fail(threadError.message, 500);
  }

  if (!thread) {
    return fail("Chat thread not found", 404);
  }

  const now = new Date().toISOString();

  const payload = normalisePayload(body.payload, messageText);

  const { data: message, error: messageError } = await supabaseAdmin
    .from("chat_messages")
    .insert({
      organisation_id: thread.organisation_id,
      project_id: thread.project_id,
      thread_id: thread.id,
      participant_id: thread.participant_id,
      sender_type: senderType,
      sender_user_id: body.sender_user_id ?? null,
      local_id: cleanText(body.local_id) || `staff-chat:${thread.id}:${Date.now()}`,
      message_text: messageText,
      payload,
      created_offline_at: null,
      synced_at: now,
    })
    .select("*")
    .single();

  if (messageError) {
    return fail(messageError.message, 500);
  }

  const { error: updateError } = await supabaseAdmin
    .from("chat_threads")
    .update({
      last_message_at: now,
      updated_at: now,
      status: thread.status ?? "open",
    })
    .eq("id", thread.id);

  if (updateError) {
    return fail(updateError.message, 500);
  }

  let pushResult: unknown = null;

  try {
    pushResult = await sendParticipantPushNotification({
      organisation_id: thread.organisation_id,
      project_id: thread.project_id,
      participant_id: thread.participant_id,
      title: "New chat message",
      body:
        messageText.length > 90
          ? `${messageText.slice(0, 90)}...`
          : messageText,
      data: {
        type: "chat_message",
        screen: "chat",
        thread_id: thread.id,
        message_id: message.id,
        message_type: "text",
      },
    });
  } catch (pushError: any) {
    pushResult = {
      sent: 0,
      skipped: true,
      reason: pushError?.message ?? "push_failed",
    };
  }

  await createAuditLog({
    organisation_id: thread.organisation_id,
    project_id: thread.project_id,
    action: "chat.staff_message_sent",
    entity_type: "chat_thread",
    entity_id: thread.id,
    metadata: {
      message_id: message.id,
      sender_type: senderType,
      message_type: "text",
      push_result: pushResult,
    },
  });

  return ok(
    {
      thread,
      message,
      push_result: pushResult,
    },
    201
  );
}