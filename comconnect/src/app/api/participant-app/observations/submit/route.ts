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

  if (!body?.observation_type_id) {
    return fail("observation_type_id is required");
  }

  const observationTypeId = String(body.observation_type_id);
  const localId =
    body.local_id ?? `observation:${observationTypeId}:${Date.now()}`;
  const createdOfflineAt = body.created_offline_at ?? null;
  const submittedAt = body.submitted_at ?? new Date().toISOString();

  const { data: obsType } = await supabaseAdmin
    .from("project_observation_types")
    .select("id, code")
    .eq("id", observationTypeId)
    .eq("project_id", auth.context.project_id)
    .maybeSingle();

  if (!obsType) {
    return fail("Observation type not found for this project", 404);
  }

  const { data, error } = await supabaseAdmin
    .from("health_observations")
    .upsert(
      {
        organisation_id: auth.context.organisation_id,
        project_id: auth.context.project_id,
        participant_id: auth.context.participant_id,
        observation_type_id: observationTypeId,
        observation_code: obsType.code,
        local_id: localId,
        values_json: body.values_json ?? {},
        severity: body.severity ?? "normal",
        alert_status: body.alert_status ?? "none",
        created_offline_at: createdOfflineAt,
        submitted_at: submittedAt,
        synced_at: new Date().toISOString(),
        metadata: body.metadata ?? {},
      },
      { onConflict: "participant_id,local_id" }
    )
    .select("*")
    .single();

  if (error) {
    return fail(error.message, 500);
  }

  await recordParticipantActivity(
    auth.context,
    "health_observation_submitted",
    "observation_type",
    observationTypeId,
    {
      observation_id: data.id,
      observation_type_id: observationTypeId,
      observation_code: obsType.code,
      values_json: body.values_json ?? {},
      severity: body.severity ?? "normal",
      alert_status: body.alert_status ?? "none",
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
    action: "health_observation.submitted",
    entity_type: "health_observation",
    entity_id: data.id,
    metadata: {
      observation_code: obsType.code,
      severity: data.severity,
      local_id: localId,
    },
  });

  return ok(data, 201);
}