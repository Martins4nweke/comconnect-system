import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { requireParticipantSession } from "@/lib/participant-app/auth";
import { verifyParticipantMessageAccess } from "@/lib/participant-app/message-security";
import { recordParticipantActivity } from "@/lib/participant-app/sync";

export async function POST(req: NextRequest) {
  const auth = await requireParticipantSession(req);
  if (auth.ok === false) return auth.response;

  const body = await req.json().catch(() => null);

  const messageId = body?.message_id ? String(body.message_id) : null;
  const replyText = body?.reply_text ? String(body.reply_text) : null;
  const createdOfflineAt = body?.created_offline_at ?? null;
  const localId =
    body?.local_id ?? `reply:${messageId ?? "general"}:${Date.now()}`;

  if (!replyText && !body?.reply_payload) {
    return fail("reply_text or reply_payload is required");
  }

  if (messageId) {
    const message = await verifyParticipantMessageAccess(
      auth.context,
      messageId
    );

    if (!message) {
      return fail("Message not found for this participant", 404);
    }
  }

  const syncedAt = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("app_message_replies")
    .upsert(
      {
        organisation_id: auth.context.organisation_id,
        project_id: auth.context.project_id,
        participant_id: auth.context.participant_id,
        message_id: messageId,
        local_id: localId,
        reply_text: replyText,
        reply_payload: body.reply_payload ?? body,
        created_offline_at: createdOfflineAt,
        synced_at: syncedAt,
      },
      { onConflict: "participant_id,local_id" }
    )
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  if (messageId) {
    const { error: eventError } = await supabaseAdmin
      .from("app_message_events")
      .upsert(
        {
          organisation_id: auth.context.organisation_id,
          project_id: auth.context.project_id,
          participant_id: auth.context.participant_id,
          message_id: messageId,
          device_id: auth.context.device_id ?? null,
          event_type: "replied",
          local_id: `${localId}:event`,
          created_offline_at: createdOfflineAt,
          metadata: {
            reply_id: data.id,
            reply_text: replyText,
            source: "online_route",
          },
        },
        { onConflict: "participant_id,local_id" }
      );

    if (eventError) return fail(eventError.message, 500);
  }

  await recordParticipantActivity(
    auth.context,
    "message_replied",
    messageId ? "app_message" : "participant",
    messageId,
    {
      message_id: messageId,
      reply_id: data.id,
      reply_text: replyText,
      source: "online_route",
      reply_payload: body.reply_payload ?? body,
    },
    localId,
    createdOfflineAt
  );

  await createAuditLog({
    organisation_id: auth.context.organisation_id,
    project_id: auth.context.project_id,
    actor_type: "participant",
    action: "participant_app.message_reply",
    entity_type: messageId ? "app_message" : "participant",
    entity_id: messageId,
    metadata: {
      local_id: localId,
      reply_id: data.id,
    },
  });

  return ok(data, 201);
}