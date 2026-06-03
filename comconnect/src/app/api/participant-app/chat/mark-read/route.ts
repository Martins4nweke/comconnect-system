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

  const threadId = body?.thread_id ? String(body.thread_id) : null;
  const localId = body?.local_id ?? `chat-read:${threadId ?? "all"}:${Date.now()}`;
  const createdOfflineAt = body?.created_offline_at ?? null;
  const readAt = body?.read_at ?? new Date().toISOString();

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

    const { error: messagesError } = await supabaseAdmin
      .from("chat_messages")
      .update({
        read_at: readAt,
        updated_at: readAt,
      })
      .eq("thread_id", threadId)
      .eq("participant_id", auth.context.participant_id)
      .neq("sender_type", "participant");

    if (messagesError) {
      return fail(messagesError.message, 500);
    }

    await recordParticipantActivity(
      auth.context,
      "chat_thread_read",
      "chat_thread",
      threadId,
      {
        thread_id: threadId,
        read_at: readAt,
        source: "online_route",
        metadata: body?.metadata ?? {},
      },
      localId,
      createdOfflineAt
    );

    await createAuditLog({
      organisation_id: auth.context.organisation_id,
      project_id: auth.context.project_id,
      actor_type: "participant",
      action: "chat.thread_read",
      entity_type: "chat_thread",
      entity_id: threadId,
      metadata: {
        local_id: localId,
        read_at: readAt,
      },
    });

    return ok(
      {
        thread_id: threadId,
        read_at: readAt,
      },
      201
    );
  }

  const { data: threads, error: threadError } = await supabaseAdmin
    .from("chat_threads")
    .select("id")
    .eq("participant_id", auth.context.participant_id)
    .eq("project_id", auth.context.project_id);

  if (threadError) {
    return fail(threadError.message, 500);
  }

  const threadIds = (threads ?? []).map((thread) => thread.id);

  if (threadIds.length > 0) {
    const { error: messagesError } = await supabaseAdmin
      .from("chat_messages")
      .update({
        read_at: readAt,
        updated_at: readAt,
      })
      .in("thread_id", threadIds)
      .eq("participant_id", auth.context.participant_id)
      .neq("sender_type", "participant");

    if (messagesError) {
      return fail(messagesError.message, 500);
    }
  }

  await recordParticipantActivity(
    auth.context,
    "chat_read",
    "chat",
    null,
    {
      thread_ids: threadIds,
      read_at: readAt,
      source: "online_route",
      metadata: body?.metadata ?? {},
    },
    localId,
    createdOfflineAt
  );

  await createAuditLog({
    organisation_id: auth.context.organisation_id,
    project_id: auth.context.project_id,
    actor_type: "participant",
    action: "chat.read",
    entity_type: "chat",
    entity_id: null,
    metadata: {
      local_id: localId,
      thread_ids: threadIds,
      read_at: readAt,
    },
  });

  return ok(
    {
      thread_ids: threadIds,
      read_at: readAt,
    },
    201
  );
}