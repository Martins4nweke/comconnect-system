import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { requireParticipantSession } from "@/lib/participant-app/auth";
import { registerParticipantDevice } from "@/lib/participant-app/device";

export async function POST(req: NextRequest) {
  const auth = await requireParticipantSession(req);
  if (auth.ok === false) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body?.device_id) return fail("device_id is required");

  try {
    const device = await registerParticipantDevice(auth.context, body);

    await createAuditLog({
      organisation_id: auth.context.organisation_id,
      project_id: auth.context.project_id,
      actor_type: "participant",
      action: "participant_app.device_registered",
      entity_type: "participant",
      entity_id: auth.context.participant_id,
      metadata: {
        device_id: body.device_id,
        platform: body.platform ?? null,
        app_version: body.app_version ?? null,
      },
    });

    return ok(device, 201);
  } catch (error: any) {
    return fail(error.message ?? "Failed to register device", 500);
  }
}
