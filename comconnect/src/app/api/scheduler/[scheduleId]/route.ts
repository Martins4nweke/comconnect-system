import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";

type Params = { params: Promise<{ scheduleId: string }> };

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function boolValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;

  const text = String(value ?? "").trim().toLowerCase();

  if (["true", "yes", "1", "y"].includes(text)) return true;
  if (["false", "no", "0", "n"].includes(text)) return false;

  return fallback;
}

function normaliseChannel(value: unknown) {
  const text = String(value ?? "").trim().toLowerCase();

  if (text === "push" || text === "app_push") return "app";
  if (["app", "sms", "voice", "whatsapp"].includes(text)) return text;

  return null;
}

function providerForChannel(channel: string | null) {
  if (channel === "app") return "expo";
  if (channel === "sms") return "africastalking";
  if (channel === "voice") return "africastalking";
  if (channel === "whatsapp") return "infobip";
  return null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { scheduleId } = await params;

  const { data, error } = await supabaseAdmin
    .from("communication_schedules")
    .select("*, participants(participant_code, phone_number, metadata)")
    .eq("id", scheduleId)
    .single();

  if (error || !data) return fail("Schedule not found", 404);

  return ok(data);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { scheduleId } = await params;
  const body = await req.json().catch(() => null);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("communication_schedules")
    .select("*")
    .eq("id", scheduleId)
    .single();

  if (existingError || !existing) {
    return fail("Schedule not found", 404);
  }

  if (["sent", "archived"].includes(existing.status)) {
    return fail("Sent or archived schedules cannot be edited", 400);
  }

  const channel = normaliseChannel(
    body?.resolved_channel ?? body?.requested_channel ?? existing.resolved_channel
  );

  const updatePayload = {
    message_code: cleanText(body?.message_code) ?? existing.message_code,
    message_title: cleanText(body?.message_title) ?? existing.message_title,
    message_body: cleanText(body?.message_body) ?? existing.message_body,

    requested_channel:
      normaliseChannel(body?.requested_channel) ?? existing.requested_channel,
    resolved_channel: channel ?? existing.resolved_channel,
    provider: providerForChannel(channel) ?? existing.provider,

    scheduled_for: body?.scheduled_for
      ? new Date(body.scheduled_for).toISOString()
      : existing.scheduled_for,

    priority: cleanText(body?.priority) ?? existing.priority,
    respect_quiet_time: boolValue(
      body?.respect_quiet_time,
      existing.respect_quiet_time ?? true
    ),

    status: body?.status ?? existing.status,

    metadata: {
      ...(existing.metadata ?? {}),
      ...(body?.metadata ?? {}),
      updated_from: "scheduler_edit",
      updated_at_client: new Date().toISOString(),
    },
  };

  const { data, error } = await supabaseAdmin
    .from("communication_schedules")
    .update(updatePayload)
    .eq("id", scheduleId)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: data.organisation_id,
    project_id: data.project_id,
    actor_type: "dashboard_user",
    action: "communication_schedule.updated",
    entity_type: "communication_schedule",
    entity_id: data.id,
    metadata: {
      participant_code: data.participant_code,
      message_code: data.message_code,
      status: data.status,
    },
  });

  return ok(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { scheduleId } = await params;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("communication_schedules")
    .select("*")
    .eq("id", scheduleId)
    .single();

  if (existingError || !existing) {
    return fail("Schedule not found", 404);
  }

  const { data, error } = await supabaseAdmin
    .from("communication_schedules")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
      metadata: {
        ...(existing.metadata ?? {}),
        archived_from: "scheduler_queue",
        archived_at_client: new Date().toISOString(),
      },
    })
    .eq("id", scheduleId)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  await createAuditLog({
    organisation_id: data.organisation_id,
    project_id: data.project_id,
    actor_type: "dashboard_user",
    action: "communication_schedule.archived",
    entity_type: "communication_schedule",
    entity_id: data.id,
    metadata: {
      participant_code: data.participant_code,
      message_code: data.message_code,
    },
  });

  return ok(data);
}