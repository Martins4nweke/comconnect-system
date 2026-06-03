import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import {
  ensureModuleEnabled,
  verifyParticipantInProject,
} from "@/lib/research-care/module-access";
import { requireString } from "@/lib/research-care/validation";
import { sendParticipantPushNotification } from "@/lib/participant-app/notifications/push";

async function resolveProjectAndParticipant(body: any) {
  const projectId = body?.project_id ? String(body.project_id).trim() : null;
  const participantId = body?.participant_id
    ? String(body.participant_id).trim()
    : null;

  const projectCode = body?.project_code
    ? String(body.project_code).trim()
    : null;

  const participantCode = body?.participant_code
    ? String(body.participant_code).trim()
    : null;

  if (projectCode && participantCode) {
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, organisation_id, project_code, status, app_access_enabled")
      .eq("project_code", projectCode)
      .maybeSingle();

    if (projectError) {
      throw new Error(projectError.message);
    }

    if (!project) {
      throw new Error("Project code not found.");
    }

    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select(
        "id, organisation_id, project_id, participant_code, status, app_access_enabled"
      )
      .eq("project_id", project.id)
      .eq("participant_code", participantCode)
      .maybeSingle();

    if (participantError) {
      throw new Error(participantError.message);
    }

    if (!participant) {
      throw new Error("Participant code not found for this project.");
    }

    return {
      project_id: project.id,
      participant,
    };
  }

  if (projectId && participantId) {
    const participant = await verifyParticipantInProject(
      participantId,
      projectId
    );

    return {
      project_id: projectId,
      participant,
    };
  }

  throw new Error(
    "project_code and participant_code are required, or project_id and participant_id are required."
  );
}

function formatAppointmentDate(value: unknown) {
  const raw = String(value ?? "").trim();

  if (!raw) return "your appointment";

  try {
    return new Date(raw).toLocaleString();
  } catch {
    return raw;
  }
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("project_id");
  const projectCode = req.nextUrl.searchParams.get("project_code");
  const participantId = req.nextUrl.searchParams.get("participant_id");
  const participantCode = req.nextUrl.searchParams.get("participant_code");

  let resolvedProjectId = projectId;

  if (!resolvedProjectId && projectCode) {
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("project_code", projectCode)
      .maybeSingle();

    if (projectError) return fail(projectError.message, 500);
    if (!project) return fail("Project code not found", 404);

    resolvedProjectId = project.id;
  }

  if (!resolvedProjectId) {
    return fail("project_id or project_code is required");
  }

  let resolvedParticipantId = participantId;

  if (!resolvedParticipantId && participantCode) {
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("id")
      .eq("project_id", resolvedProjectId)
      .eq("participant_code", participantCode)
      .maybeSingle();

    if (participantError) return fail(participantError.message, 500);
    if (!participant) return fail("Participant code not found", 404);

    resolvedParticipantId = participant.id;
  }

  let query = supabaseAdmin
    .from("appointments")
    .select("*")
    .eq("project_id", resolvedProjectId)
    .order("start_at", { ascending: true });

  if (resolvedParticipantId) {
    query = query.eq("participant_id", resolvedParticipantId);
  }

  const { data, error } = await query;

  if (error) {
    return fail(error.message, 500);
  }

  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  try {
    const { project_id, participant } = await resolveProjectAndParticipant(
      body
    );

    await ensureModuleEnabled(project_id, "appointments");

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .insert({
        organisation_id: participant.organisation_id,
        project_id: participant.project_id,
        participant_id: participant.id,
        appointment_type: body.appointment_type ?? "follow_up",
        title: requireString(body.title, "title"),
        description: body.description ?? null,
        location: body.location ?? null,
        start_at: requireString(body.start_at, "start_at"),
        end_at: body.end_at ?? null,
        status: body.status ?? "scheduled",
        assigned_user_id: body.assigned_user_id ?? null,
        metadata: {
          ...(body.metadata ?? {}),
          project_code: body.project_code ?? null,
          participant_code: body.participant_code ?? null,
        },
      })
      .select("*")
      .single();

    if (error) {
      return fail(error.message, 500);
    }

    let pushResult: unknown = null;

    try {
      const titleText = String(data.title ?? "New appointment");
      const appointmentTime = formatAppointmentDate(data.start_at);

      pushResult = await sendParticipantPushNotification({
        organisation_id: participant.organisation_id,
        project_id: participant.project_id,
        participant_id: participant.id,
        title: "New appointment",
        body: `${titleText} - ${appointmentTime}`,
        data: {
          type: "appointment",
          screen: "appointments",
          appointment_id: data.id,
          start_at: data.start_at,
        },
      });
    } catch (pushError: any) {
      pushResult = {
        sent: 0,
        skipped: true,
        reason: pushError?.message ?? "push_failed",
      };
    }

    await createAuditLog({
      organisation_id: participant.organisation_id,
      project_id: participant.project_id,
      actor_type: "dashboard_user",
      action: "appointment.created",
      entity_type: "appointment",
      entity_id: data.id,
      metadata: {
        participant_id: participant.id,
        participant_code: body.participant_code ?? null,
        title: data.title,
        push_result: pushResult,
      },
    });

    return ok(
      {
        appointment: data,
        push_result: pushResult,
      },
      201
    );
  } catch (error: any) {
    return fail(error.message ?? "Failed to create appointment", 400);
  }
}