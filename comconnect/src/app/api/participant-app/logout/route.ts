import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok } from "@/lib/comconnect-core/api-response";
import { createAuditLog } from "@/lib/comconnect-core/audit";
import { requireParticipantSession } from "@/lib/participant-app/auth";

export async function POST(req: NextRequest) {
  const auth = await requireParticipantSession(req);
  if (auth.ok === false) return auth.response;

  await supabaseAdmin
    .from("participant_app_sessions")
    .update({ status: "revoked" })
    .eq("id", auth.context.session_id);

  await createAuditLog({
    organisation_id: auth.context.organisation_id,
    project_id: auth.context.project_id,
    actor_type: "participant",
    action: "participant_app.logout",
    entity_type: "participant",
    entity_id: auth.context.participant_id,
    metadata: {
      session_id: auth.context.session_id,
      device_id: auth.context.device_id ?? null,
    },
  });

  return ok({ logged_out: true });
}
