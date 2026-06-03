import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";

type Params = { params: Promise<{ participantId: string }> };

function boolValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;

  const text = String(value ?? "").trim().toLowerCase();

  if (["true", "yes", "1", "y"].includes(text)) return true;
  if (["false", "no", "0", "n"].includes(text)) return false;

  return fallback;
}

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { participantId } = await params;

  const { data, error } = await supabaseAdmin
    .from("participants")
    .select("*, projects(name, project_code), organisations(name)")
    .eq("id", participantId)
    .single();

  if (error || !data) {
    return fail("Participant not found", 404);
  }

  return ok(data);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { participantId } = await params;
  const body = await req.json().catch(() => null);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("participants")
    .select("*")
    .eq("id", participantId)
    .single();

  if (existingError || !existing) {
    return fail("Participant not found", 404);
  }

  const existingMetadata =
    existing.metadata && typeof existing.metadata === "object"
      ? existing.metadata
      : {};

  const metadata = {
    ...existingMetadata,
    display_name: body?.display_name ?? existingMetadata.display_name ?? null,
    email: body?.email ?? existingMetadata.email ?? null,
    whatsapp_number:
      body?.whatsapp_number ?? existingMetadata.whatsapp_number ?? null,

    preferred_channel:
      body?.preferred_channel ?? existingMetadata.preferred_channel ?? "app",
    fallback_allowed: boolValue(
      body?.fallback_allowed ?? existingMetadata.fallback_allowed,
      true
    ),

    quiet_time_enabled: boolValue(
      body?.quiet_time_enabled ?? existingMetadata.quiet_time_enabled,
      true
    ),
    quiet_time_start:
      body?.quiet_time_start ?? existingMetadata.quiet_time_start ?? "20:00",
    quiet_time_end:
      body?.quiet_time_end ?? existingMetadata.quiet_time_end ?? "07:00",
    timezone: body?.timezone ?? existingMetadata.timezone ?? "Africa/Johannesburg",

    updated_from: "participant_edit_page",
    updated_at_client: new Date().toISOString(),
  };

  const updatePayload = {
    phone_number: cleanText(body?.phone_number),
    first_name: cleanText(body?.first_name),
    last_name: cleanText(body?.last_name),
    preferred_language: body?.preferred_language ?? "en",
    status: body?.status ?? "active",
    app_access_enabled: boolValue(body?.app_access_enabled, true),
    metadata,
  };

  const { data, error } = await supabaseAdmin
    .from("participants")
    .update(updatePayload)
    .eq("id", participantId)
    .select("*")
    .single();

  if (error) {
    return fail(error.message, 500);
  }

  await createAuditLog({
    organisation_id: data.organisation_id,
    project_id: data.project_id,
    actor_type: "dashboard_user",
    action: "participant.updated",
    entity_type: "participant",
    entity_id: data.id,
    metadata: {
      participant_code: data.participant_code,
      changed_fields: Object.keys(updatePayload),
    },
  });

  return ok(data);
}