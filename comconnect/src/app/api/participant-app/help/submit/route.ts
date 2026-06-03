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

  const localId = body?.local_id ?? `help:${Date.now()}`;
  const category = body?.category ?? "general";
  const message = body?.message ?? null;
  const priority = body?.priority ?? "normal";
  const createdOfflineAt = body?.created_offline_at ?? null;
  const syncedAt = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("help_requests")
    .upsert(
      {
        organisation_id: auth.context.organisation_id,
        project_id: auth.context.project_id,
        participant_id: auth.context.participant_id,
        local_id: localId,
        category,
        message,
        priority,
        status: "open",
        created_offline_at: createdOfflineAt,
        synced_at: syncedAt,
        metadata: body?.metadata ?? {},
      },
      { onConflict: "participant_id,local_id" }
    )
    .select("*")
    .single();

  if (error) {
    return fail(error.message, 500);
  }

  const { error: inboxError } = await supabaseAdmin.from("inbox_items").insert({
    organisation_id: auth.context.organisation_id,
    project_id: auth.context.project_id,
    participant_id: auth.context.participant_id,
    source_type: "help_request",
    source_id: data.id,
    title: "Participant help request",
    summary: data.message,
    priority: data.priority,
    status: "open",
  });

  if (inboxError) {
    return fail(inboxError.message, 500);
  }

  await recordParticipantActivity(
    auth.context,
    "help_request_submitted",
    "help_request",
    data.id,
    {
      help_request_id: data.id,
      category,
      message,
      priority,
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
    action: "help_request.created",
    entity_type: "help_request",
    entity_id: data.id,
    metadata: {
      priority: data.priority,
      category: data.category,
      local_id: localId,
    },
  });

  return ok(data, 201);
}