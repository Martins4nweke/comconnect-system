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
import {
  getScopedContext,
  isOrganisationAdmin,
  isProjectManager,
} from "@/lib/comconnect-core/access-scope";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function canManageAppointments(
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
  const organisationRole = cleanText(context.organisation_role).toLowerCase();
  const projectRole = cleanText(context.project_role).toLowerCase();

  return (
    isOrganisationAdmin(organisationRole) ||
    isProjectManager(projectRole) ||
    [
      "project_manager",
      "research_assistant",
      "data_manager",
      "clinician",
      "nurse",
    ].includes(projectRole)
  );
}

function resolveAllowedProjectId(
  context: Awaited<ReturnType<typeof getScopedContext>>,
  requestedProjectId?: string | null
) {
  const requested = cleanText(requestedProjectId);

  if (requested) {
    if (
      requested === context.active_project_id ||
      context.allowed_project_ids.includes(requested)
    ) {
      return requested;
    }

    throw new Error("Project not found or not allowed.");
  }

  if (context.active_project_id) return context.active_project_id;

  if (context.allowed_project_ids.length > 0) {
    return context.allowed_project_ids[0];
  }

  throw new Error("No accessible project found.");
}

async function resolveProjectByCode(
  context: Awaited<ReturnType<typeof getScopedContext>>,
  projectCode: string
) {
  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id, organisation_id, project_code, status, app_access_enabled")
    .eq("organisation_id", context.organisation_id)
    .eq("project_code", projectCode)
    .neq("status", "archived")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!project) throw new Error("Project code not found.");

  if (!context.allowed_project_ids.includes(project.id)) {
    throw new Error("You do not have access to this project.");
  }

  return project;
}

async function resolveProjectAndParticipant(
  body: any,
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
  const projectId = cleanText(body?.project_id);
  const participantId = cleanText(body?.participant_id);
  const projectCode = cleanText(body?.project_code);
  const participantCode = cleanText(body?.participant_code);

  if (projectCode && participantCode) {
    const project = await resolveProjectByCode(context, projectCode);

    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select(
        "id, organisation_id, project_id, participant_code, status, app_access_enabled"
      )
      .eq("organisation_id", context.organisation_id)
      .eq("project_id", project.id)
      .eq("participant_code", participantCode)
      .maybeSingle();

    if (participantError) throw new Error(participantError.message);

    if (!participant) {
      throw new Error("Participant code not found for this project.");
    }

    return {
      project_id: project.id,
      participant,
    };
  }

  if (projectId && participantId) {
    const allowedProjectId = resolveAllowedProjectId(context, projectId);

    const participant = await verifyParticipantInProject(
      participantId,
      allowedProjectId
    );

    if (participant.organisation_id !== context.organisation_id) {
      throw new Error("Participant not found or not allowed.");
    }

    return {
      project_id: allowedProjectId,
      participant,
    };
  }

  throw new Error(
    "project_code and participant_code are required, or project_id and participant_id are required."
  );
}

function formatAppointmentDate(value: unknown) {
  const raw = cleanText(value);

  if (!raw) return "your appointment";

  try {
    return new Date(raw).toLocaleString();
  } catch {
    return raw;
  }
}

export async function GET(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    const projectId = req.nextUrl.searchParams.get("project_id");
    const projectCode = cleanText(req.nextUrl.searchParams.get("project_code"));
    const participantId = cleanText(
      req.nextUrl.searchParams.get("participant_id")
    );
    const participantCode = cleanText(
      req.nextUrl.searchParams.get("participant_code")
    );

    let resolvedProjectId: string | null = null;

    if (projectCode) {
      const project = await resolveProjectByCode(context, projectCode);
      resolvedProjectId = project.id;
    } else if (projectId) {
      resolvedProjectId = resolveAllowedProjectId(context, projectId);
    } else if (context.active_project_id) {
      resolvedProjectId = context.active_project_id;
    }

    let query = supabaseAdmin
      .from("appointments")
      .select("*")
      .eq("organisation_id", context.organisation_id)
      .order("start_at", { ascending: true });

    if (resolvedProjectId) {
      query = query.eq("project_id", resolvedProjectId);
    } else if (context.allowed_project_ids.length > 0) {
      query = query.in("project_id", context.allowed_project_ids);
    } else {
      query = query.eq("project_id", "__no_project_access__");
    }

    if (participantId) {
      query = query.eq("participant_id", participantId);
    }

    if (participantCode) {
      const projectForParticipant =
        resolvedProjectId ?? resolveAllowedProjectId(context, null);

      const { data: participant, error: participantError } = await supabaseAdmin
        .from("participants")
        .select("id")
        .eq("organisation_id", context.organisation_id)
        .eq("project_id", projectForParticipant)
        .eq("participant_code", participantCode)
        .maybeSingle();

      if (participantError) return fail(participantError.message, 500);
      if (!participant) return fail("Participant code not found", 404);

      query = query.eq("participant_id", participant.id);
    }

    const { data, error } = await query;

    if (error) return fail(error.message, 500);

    return ok(data ?? []);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load appointments", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await getScopedContext(req);

    if (!canManageAppointments(context)) {
      return fail("You do not have permission to create appointments.", 403);
    }

    const body = await req.json().catch(() => null);

    const { project_id, participant } = await resolveProjectAndParticipant(
      body,
      context
    );

    await ensureModuleEnabled(project_id, "appointments");

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .insert({
        organisation_id: participant.organisation_id,
        project_id: participant.project_id,
        participant_id: participant.id,
        appointment_type: body?.appointment_type ?? "follow_up",
        title: requireString(body?.title, "title"),
        description: body?.description ?? null,
        location: body?.location ?? null,
        start_at: requireString(body?.start_at, "start_at"),
        end_at: body?.end_at ?? null,
        status: body?.status ?? "scheduled",
        assigned_user_id: body?.assigned_user_id ?? null,
        metadata: {
          ...(body?.metadata ?? {}),
          project_code: body?.project_code ?? null,
          participant_code: body?.participant_code ?? null,
          created_from: body?.created_from ?? "appointments_api",
        },
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

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
  participant_code:
    body?.participant_code ??
    ("participant_code" in participant ? participant.participant_code : null),
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
    return fail(error?.message ?? "Failed to create appointment", 400);
  }
}