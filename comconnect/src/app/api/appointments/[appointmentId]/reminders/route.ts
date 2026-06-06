import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import {
  getScopedContext,
  isOrganisationAdmin,
  isProjectManager,
} from "@/lib/comconnect-core/access-scope";

type Params = { params: Promise<{ appointmentId: string }> };

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

function applyAppointmentScope(
  query: any,
  context: Awaited<ReturnType<typeof getScopedContext>>
) {
  query = query.eq("organisation_id", context.organisation_id);

  if (context.active_project_id) {
    return query.eq("project_id", context.active_project_id);
  }

  if (context.allowed_project_ids.length > 0) {
    return query.in("project_id", context.allowed_project_ids);
  }

  return query.eq("project_id", "__no_project_access__");
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const context = await getScopedContext(req);
    const { appointmentId } = await params;

    let appointmentQuery = supabaseAdmin
      .from("appointments")
      .select("id, organisation_id, project_id")
      .eq("id", appointmentId);

    appointmentQuery = applyAppointmentScope(appointmentQuery, context);

    const { data: appointment, error: appointmentError } =
      await appointmentQuery.maybeSingle();

    if (appointmentError) return fail(appointmentError.message, 500);

    if (!appointment) {
      return fail("Appointment not found or not allowed.", 404);
    }

    const { data, error } = await supabaseAdmin
      .from("appointment_reminders")
      .select("*")
      .eq("organisation_id", appointment.organisation_id)
      .eq("project_id", appointment.project_id)
      .eq("appointment_id", appointment.id)
      .order("scheduled_for", { ascending: true });

    if (error) return fail(error.message, 500);

    return ok(data ?? []);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to load appointment reminders", 500);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const context = await getScopedContext(req);

    if (!canManageAppointments(context)) {
      return fail(
        "You do not have permission to create appointment reminders.",
        403
      );
    }

    const { appointmentId } = await params;
    const body = await req.json().catch(() => null);

    let appointmentQuery = supabaseAdmin
      .from("appointments")
      .select("id, organisation_id, project_id, participant_id")
      .eq("id", appointmentId);

    appointmentQuery = applyAppointmentScope(appointmentQuery, context);

    const { data: appointment, error: appError } =
      await appointmentQuery.maybeSingle();

    if (appError) return fail(appError.message, 500);

    if (!appointment) {
      return fail("Appointment not found or not allowed.", 404);
    }

    const { data, error } = await supabaseAdmin
      .from("appointment_reminders")
      .insert({
        organisation_id: appointment.organisation_id,
        project_id: appointment.project_id,
        appointment_id: appointment.id,
        participant_id: appointment.participant_id,
        reminder_channel: body?.reminder_channel ?? "app",
        scheduled_for: body?.scheduled_for ?? new Date().toISOString(),
        status: body?.status ?? "pending",
        metadata: {
          ...(body?.metadata ?? {}),
          created_from: body?.created_from ?? "appointment_reminders_api",
        },
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    return ok(data, 201);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to create appointment reminder", 400);
  }
}