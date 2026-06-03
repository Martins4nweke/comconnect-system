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

  if (!body?.appointment_id) {
    return fail("appointment_id is required");
  }

  if (!body?.response) {
    return fail("response is required");
  }

  const appointmentId = String(body.appointment_id);
  const response = String(body.response);
  const localId =
    body.local_id ?? `appointment:${appointmentId}:${Date.now()}`;
  const createdOfflineAt = body.created_offline_at ?? null;
  const respondedAt = body.responded_at ?? new Date().toISOString();

  const { data: appointment } = await supabaseAdmin
    .from("appointments")
    .select("id")
    .eq("id", appointmentId)
    .eq("participant_id", auth.context.participant_id)
    .maybeSingle();

  if (!appointment) {
    return fail("Appointment not found for this participant", 404);
  }

  const { data, error } = await supabaseAdmin
    .from("appointment_responses")
    .upsert(
      {
        organisation_id: auth.context.organisation_id,
        project_id: auth.context.project_id,
        participant_id: auth.context.participant_id,
        appointment_id: appointmentId,
        local_id: localId,
        response,
        note: body.note ?? null,
        requested_new_time: body.requested_new_time ?? null,
        created_offline_at: createdOfflineAt,
        responded_at: respondedAt,
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

  const { error: updateError } = await supabaseAdmin
    .from("appointments")
    .update({
      status: response,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId);

  if (updateError) {
    return fail(updateError.message, 500);
  }

  await recordParticipantActivity(
    auth.context,
    "appointment_responded",
    "appointment",
    appointmentId,
    {
      appointment_id: appointmentId,
      appointment_response_id: data.id,
      response,
      note: body.note ?? null,
      requested_new_time: body.requested_new_time ?? null,
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
    action: "appointment.responded",
    entity_type: "appointment",
    entity_id: appointmentId,
    metadata: {
      response,
      response_id: data.id,
      local_id: localId,
    },
  });

  return ok(data, 201);
}