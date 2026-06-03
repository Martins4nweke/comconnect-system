import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { sendParticipantPushNotification } from "@/lib/participant-app/notifications/push";

function normaliseSenderType(value: unknown) {
  const senderType = String(value ?? "staff").trim();

  if (senderType === "participant") return "participant";
  if (senderType === "staff") return "staff";
  if (senderType === "admin") return "admin";

  return "staff";
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body?.thread_id) {
    return fail("thread_id is required");
  }

  if (!body?.message_text) {
    return fail("message_text is required");
  }

  const threadId = String(body.thread_id);
  const messageText = String(body.message_text).trim();
  const senderType = normaliseSenderType(body.sender_type);

  if (!messageText) {
    return fail("message_text is required");
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

  const { data: message, error: messageError } = await supabaseAdmin
    .from("chat_messages")
    .insert({
      organisation_id: thread.organisation_id,
      project_id: thread.project_id,
      thread_id: thread.id,
      participant_id: thread.participant_id,
      sender_type: senderType,
      sender_user_id: body.sender_user_id ?? null,
      local_id: body.local_id ?? `staff-chat:${thread.id}:${Date.now()}`,
      message_text: messageText,
      payload: body.payload ?? {},
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