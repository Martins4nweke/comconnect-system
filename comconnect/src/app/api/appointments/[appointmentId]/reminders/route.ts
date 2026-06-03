import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";

type Params = { params: Promise<{ appointmentId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { appointmentId } = await params;

  const { data, error } = await supabaseAdmin
    .from("appointment_reminders")
    .select("*")
    .eq("appointment_id", appointmentId)
    .order("scheduled_for", { ascending: true });

  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { appointmentId } = await params;
  const body = await req.json().catch(() => null);

  const { data: appointment, error: appError } = await supabaseAdmin
    .from("appointments")
    .select("id, organisation_id, project_id, participant_id")
    .eq("id", appointmentId)
    .single();

  if (appError || !appointment) return fail("Appointment not found", 404);

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
      metadata: body?.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) return fail(error.message, 500);
  return ok(data, 201);
}
