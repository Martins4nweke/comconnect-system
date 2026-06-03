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

  if (!body?.education_item_id) {
    return fail("education_item_id is required");
  }

  const educationItemId = String(body.education_item_id);
  const progressStatus = String(body.progress_status ?? "viewed");
  const progressPercent = body.progress_percent ?? 0;
  const localId =
    body.local_id ?? `education:${educationItemId}:${Date.now()}`;
  const createdOfflineAt = body.created_offline_at ?? null;
  const now = new Date().toISOString();

  const { data: item } = await supabaseAdmin
    .from("education_items")
    .select("id")
    .eq("id", educationItemId)
    .eq("project_id", auth.context.project_id)
    .maybeSingle();

  if (!item) {
    return fail("Education item not found for this project", 404);
  }

  const completedAt =
    progressStatus === "completed"
      ? body.completed_at ?? now
      : null;

  const { data, error } = await supabaseAdmin
    .from("education_progress")
    .upsert(
      {
        organisation_id: auth.context.organisation_id,
        project_id: auth.context.project_id,
        participant_id: auth.context.participant_id,
        education_item_id: educationItemId,
        education_version_id: body.education_version_id ?? null,
        progress_status: progressStatus,
        progress_percent: progressPercent,
        local_id: localId,
        created_offline_at: createdOfflineAt,
        last_viewed_at: now,
        completed_at: completedAt,
        metadata: body.metadata ?? {},
      },
      { onConflict: "participant_id,education_item_id" }
    )
    .select("*")
    .single();

  if (error) {
    return fail(error.message, 500);
  }

  await recordParticipantActivity(
    auth.context,
    progressStatus === "completed"
      ? "education_completed"
      : "education_progress",
    "education_item",
    educationItemId,
    {
      education_item_id: educationItemId,
      education_progress_id: data.id,
      education_version_id: body.education_version_id ?? null,
      progress_status: progressStatus,
      progress_percent: progressPercent,
      source: "online_route",
      metadata: body.metadata ?? {},
    },
    localId,
    createdOfflineAt
  );

  await createAuditLog({
    organisation_id: auth.context.organisation_id,
    project_id: auth.context.project_id,
    actor_type: "participant",
    action: "education.progress_updated",
    entity_type: "education_item",
    entity_id: educationItemId,
    metadata: {
      progress_status: data.progress_status,
      progress_percent: data.progress_percent,
      local_id: localId,
    },
  });

  return ok(data, 201);
}