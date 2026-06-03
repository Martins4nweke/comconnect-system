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

  if (!body?.questionnaire_id) {
    return fail("questionnaire_id is required");
  }

  const questionnaireId = String(body.questionnaire_id);
  const localId =
    body.local_id ?? `questionnaire:${questionnaireId}:${Date.now()}`;
  const createdOfflineAt = body.created_offline_at ?? null;
  const submittedAt = body.submitted_at ?? new Date().toISOString();

  const { data: questionnaire } = await supabaseAdmin
    .from("questionnaires")
    .select("id")
    .eq("id", questionnaireId)
    .eq("project_id", auth.context.project_id)
    .maybeSingle();

  if (!questionnaire) {
    return fail("Questionnaire not found for this project", 404);
  }

  const { data, error } = await supabaseAdmin
    .from("questionnaire_responses")
    .upsert(
      {
        organisation_id: auth.context.organisation_id,
        project_id: auth.context.project_id,
        participant_id: auth.context.participant_id,
        questionnaire_id: questionnaireId,
        local_id: localId,
        answers: body.answers ?? {},
        status: body.status ?? "submitted",
        score: body.score ?? {},
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
    "questionnaire_submitted",
    "questionnaire",
    questionnaireId,
    {
      questionnaire_id: questionnaireId,
      response_id: data.id,
      status: body.status ?? "submitted",
      source: "online_route",
      answers: body.answers ?? {},
      score: body.score ?? {},
      metadata: body.metadata ?? {},
    },
    localId,
    createdOfflineAt
  );

  await createAuditLog({
    organisation_id: auth.context.organisation_id,
    project_id: auth.context.project_id,
    actor_type: "participant",
    action: "questionnaire.submitted",
    entity_type: "questionnaire",
    entity_id: questionnaireId,
    metadata: {
      response_id: data.id,
      local_id: localId,
    },
  });

  return ok(data, 201);
}