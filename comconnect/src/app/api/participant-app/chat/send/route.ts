import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { requireParticipantSession } from "@/lib/participant-app/auth";
import { recordParticipantActivity } from "@/lib/participant-app/sync";

export async function POST(req: NextRequest) {
  const auth = await requireParticipantSession(req);
  if (auth.ok === false) return auth.response;

  const body = await req.json().catch(() => null);

  const messageText = body?.message_text ? String(body.message_text) : null;
  const createdOfflineAt = body?.created_offline_at ?? null;
  const localId = body?.local_id ?? `chat:${Date.now()}`;

  if (!messageText && !body?.payload) {
    return fail("message_text or payload is required");
  }

  let threadId = body?.thread_id ? String(body.thread_id) : null;

  if (threadId) {
    const { data: thread } = await supabaseAdmin
      .from("chat_threads")
      .select("id")
      .eq("id", threadId)
      .eq("participant_id", auth.context.participant_id)
      .maybeSingle();

    if (!thread) {
      return fail("Chat thread not found for this participant", 404);
    }
  } else {
    const { data: newThread, error: threadError } = await supabaseAdmin
      .from("chat_threads")
      .insert({
        organisation_id: auth.context.organisation_id,
        project_id: auth.context.project_id,
        participant_id: auth.context.participant_id,
        subject: body?.subject ?? "Participant message",
        status: "open",
        last_message_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (threadError) {
      return fail(threadError.message, 500);
    }

    threadId = newThread.id;
  }

  const syncedAt = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("chat_messages")
    .upsert(
      {
        organisation_id: auth.context.organisation_id,
        project_id: auth.context.project_id,
        thread_id: threadId,
        participant_id: auth.context.participant_id,
        sender_type: "participant",
        local_id: localId,
        message_text: messageText,
        payload: body?.payload ?? body ?? {},
        created_offline_at: createdOfflineAt,
        synced_at: syncedAt,
      },
      { onConflict: "participant_id,local_id" }
    )
    .select("*")
    .single();

  if (error) {
    return fail(error.message, 500);
  }

  const { error: threadUpdateError } = await supabaseAdmin
    .from("chat_threads")
    .update({
      last_message_at: syncedAt,
      updated_at: syncedAt,
    })
    .eq("id", threadId);

  if (threadUpdateError) {
    return fail(threadUpdateError.message, 500);
  }

  await recordParticipantActivity(
    auth.context,
    "chat_message_sent",
    "chat_thread",
    threadId,
    {
      thread_id: threadId,
      message_id: data.id,
      message_text: messageText,
      source: "online_route",
      payload: body?.payload ?? body ?? {},
    },
    localId,
    createdOfflineAt
  );

  await createAuditLog({
    organisation_id: auth.context.organisation_id,
    project_id: auth.context.project_id,
    actor_type: "participant",
    action: "chat.message_sent",
    entity_type: "chat_thread",
    entity_id: threadId,
    metadata: {
      message_id: data.id,
      local_id: localId,
    },
  });

  return ok({ thread_id: threadId, message: data }, 201);
}