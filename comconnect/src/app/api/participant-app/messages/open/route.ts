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

  if (!body?.message_id) {
    return fail("message_id is required");
  }

  const messageId = String(body.message_id);

  const message = await verifyParticipantMessageAccess(
    auth.context,
    messageId
  );

  if (!message) {
    return fail("Message not found for this participant", 404);
  }

  const localId = body.local_id ?? `open:${messageId}:${Date.now()}`;
  const createdOfflineAt = body.created_offline_at ?? null;

  const metadata = {
    ...(body.metadata ?? {}),
    source: "online_route",
  };

  const { data, error } = await supabaseAdmin
    .from("app_message_events")
    .upsert(
      {
        organisation_id: auth.context.organisation_id,
        project_id: auth.context.project_id,
        participant_id: auth.context.participant_id,
        message_id: messageId,
        device_id: auth.context.device_id ?? null,
        event_type: "opened",
        local_id: localId,
        created_offline_at: createdOfflineAt,
        metadata,
      },
      { onConflict: "participant_id,local_id" }
    )
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  await recordParticipantActivity(
    auth.context,
    "message_opened",
    "app_message",
    messageId,
    {
      message_id: messageId,
      source: "online_route",
      metadata,
    },
    localId,
    createdOfflineAt
  );

  await createAuditLog({
    organisation_id: auth.context.organisation_id,
    project_id: auth.context.project_id,
    actor_type: "participant",
    action: "participant_app.message_opened",
    entity_type: "app_message",
    entity_id: messageId,
    metadata: {
      local_id: localId,
    },
  });

  return ok(data, 201);
}