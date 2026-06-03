import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireParticipantSession } from "@/lib/participant-app/auth";
import { createAuditLog } from "@/lib/comconnect-core/audit";

function normalisePushToken(value: unknown) {
  const token = String(value ?? "").trim();

  if (!token) return null;

  if (!token.startsWith("ExponentPushToken[")) {
    return null;
  }

  return token;
}

export async function POST(req: NextRequest) {
  const auth = await requireParticipantSession(req);
  if (auth.ok === false) return auth.response;

  const body = await req.json().catch(() => null);

  const pushToken = normalisePushToken(body?.push_token);
  const pushProvider = body?.push_provider
    ? String(body.push_provider).trim()
    : "expo";

  if (!pushToken) {
    return fail("Valid Expo push_token is required", 400);
  }

  const appDeviceId = auth.context.device_id;

  if (!appDeviceId) {
    return fail("No device is linked to this participant session", 400);
  }

  const updatePayload = {
    push_token: pushToken,
    push_provider: pushProvider,
    notifications_enabled: true,
    last_seen_at: new Date().toISOString(),
  };

  const { data: updatedDevice, error: updateError } = await supabaseAdmin
    .from("participant_devices")
    .update(updatePayload)
    .eq("device_id", appDeviceId)
    .eq("participant_id", auth.context.participant_id)
    .select("*")
    .maybeSingle();

  if (updateError) {
    return fail(updateError.message, 500);
  }

  let device = updatedDevice;

  if (!device) {
    const { data: insertedDevice, error: insertError } = await supabaseAdmin
      .from("participant_devices")
      .insert({
        organisation_id: auth.context.organisation_id,
        project_id: auth.context.project_id,
        participant_id: auth.context.participant_id,
        device_id: appDeviceId,
        platform: auth.context.platform ?? null,
        app_version: auth.context.app_version ?? null,
        ...updatePayload,
      })
      .select("*")
      .single();

    if (insertError) {
      return fail(insertError.message, 500);
    }

    device = insertedDevice;
  }

  await createAuditLog({
    organisation_id: auth.context.organisation_id,
    project_id: auth.context.project_id,
    actor_type: "participant",
    action: "participant_app.push_token_registered",
    entity_type: "participant_device",
    entity_id: device.id,
    metadata: {
      app_device_id: appDeviceId,
      participant_device_id: device.id,
      push_provider: pushProvider,
      notifications_enabled: true,
    },
  });

  return ok({
    registered: true,
    device,
  });
}