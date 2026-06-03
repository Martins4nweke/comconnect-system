import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { requireParticipantSession } from "@/lib/participant-app/auth";
import { recordParticipantActivity } from "@/lib/participant-app/sync";

function normaliseReferralStatus(value: unknown) {
  const raw = value ? String(value) : "contacted";

  if (raw === "attended") return "completed";
  if (raw === "completed") return "completed";
  if (raw === "needs_help") return "under_review";
  if (raw === "participant_not_ready") return "participant_not_ready";
  if (raw === "follow_up_scheduled") return "follow_up_scheduled";
  if (raw === "under_review") return "under_review";
  if (raw === "archived") return "archived";

  return "contacted";
}

export async function POST(req: NextRequest) {
  const auth = await requireParticipantSession(req);
  if (auth.ok === false) return auth.response;

  const body = await req.json().catch(() => null);

  if (!body?.referral_id) {
    return fail("referral_id is required");
  }

  const referralId = String(body.referral_id);
  const localId = body.local_id ?? `referral:${referralId}:${Date.now()}`;
  const createdOfflineAt = body.created_offline_at ?? null;
  const respondedAt = body.responded_at ?? new Date().toISOString();
  const status = normaliseReferralStatus(body.status ?? body.response);

  const { data: referral } = await supabaseAdmin
    .from("referrals")
    .select("id")
    .eq("id", referralId)
    .eq("participant_id", auth.context.participant_id)
    .maybeSingle();

  if (!referral) {
    return fail("Referral not found for this participant", 404);
  }

  const note = body.note ?? body.response ?? "Participant responded via app.";

  const { data: noteData, error: noteError } = await supabaseAdmin
    .from("referral_notes")
    .insert({
      organisation_id: auth.context.organisation_id,
      project_id: auth.context.project_id,
      referral_id: referralId,
      participant_id: auth.context.participant_id,
      note,
    })
    .select("*")
    .single();

  if (noteError) {
    return fail(noteError.message, 500);
  }

  const { error: updateError } = await supabaseAdmin
    .from("referrals")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", referralId)
    .eq("participant_id", auth.context.participant_id);

  if (updateError) {
    return fail(updateError.message, 500);
  }

  await recordParticipantActivity(
    auth.context,
    "referral_responded",
    "referral",
    referralId,
    {
      referral_id: referralId,
      referral_note_id: noteData.id,
      status,
      original_status: body.status ?? null,
      response: body.response ?? null,
      note,
      responded_at: respondedAt,
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
    action: "referral.responded",
    entity_type: "referral",
    entity_id: referralId,
    metadata: {
      note_id: noteData.id,
      status,
      original_status: body.status ?? null,
      local_id: localId,
    },
  });

  return ok(
    {
      referral_id: referralId,
      note: noteData,
      status,
    },
    201
  );
}