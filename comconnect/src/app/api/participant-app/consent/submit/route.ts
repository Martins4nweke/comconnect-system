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

  if (!body?.consent_form_id) {
    return fail("consent_form_id is required");
  }

  if (!body?.consent_version_id) {
    return fail("consent_version_id is required");
  }

  const consentFormId = String(body.consent_form_id);
  const consentVersionId = String(body.consent_version_id);
  const accepted = Boolean(body.accepted);
  const localId =
    body.local_id ?? `consent:${consentVersionId}:${Date.now()}`;
  const createdOfflineAt = body.created_offline_at ?? null;
  const now = new Date().toISOString();

  const { data: version } = await supabaseAdmin
    .from("consent_versions")
    .select("id, consent_form_id")
    .eq("id", consentVersionId)
    .eq("project_id", auth.context.project_id)
    .maybeSingle();

  if (!version || version.consent_form_id !== consentFormId) {
    return fail("Consent version not found for this project/form", 404);
  }

  const acceptedAt = accepted ? body.accepted_at ?? now : null;
  const declinedAt = accepted ? null : body.declined_at ?? now;

  const { data, error } = await supabaseAdmin
    .from("participant_consents")
    .upsert(
      {
        organisation_id: auth.context.organisation_id,
        project_id: auth.context.project_id,
        participant_id: auth.context.participant_id,
        consent_form_id: consentFormId,
        consent_version_id: consentVersionId,
        local_id: localId,
        accepted,
        typed_name: body.typed_name ?? null,
        signature_url: body.signature_url ?? null,
        language: body.language ?? null,
        created_offline_at: createdOfflineAt,
        accepted_at: acceptedAt,
        synced_at: now,
        metadata: {
          ...(body.metadata ?? {}),
          declined_at: declinedAt,
        },
      },
      { onConflict: "participant_id,consent_version_id" }
    )
    .select("*")
    .single();

  if (error) {
    return fail(error.message, 500);
  }

  await recordParticipantActivity(
    auth.context,
    accepted ? "consent_accepted" : "consent_declined",
    "consent_form",
    consentFormId,
    {
      consent_form_id: consentFormId,
      consent_version_id: consentVersionId,
      consent_id: data.id,
      accepted,
      accepted_at: acceptedAt,
      declined_at: declinedAt,
      typed_name: body.typed_name ?? null,
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
    action: accepted ? "consent.accepted" : "consent.declined",
    entity_type: "consent_form",
    entity_id: consentFormId,
    metadata: {
      consent_id: data.id,
      accepted: data.accepted,
      local_id: localId,
    },
  });

  return ok(data, 201);
}