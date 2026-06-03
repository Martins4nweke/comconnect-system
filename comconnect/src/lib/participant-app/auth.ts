import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fail } from "@/lib/comconnect-core/api-response";
import {
  hashParticipantSessionToken,
  verifyParticipantSessionTokenShape,
} from "./session-token";
import type { ParticipantAppSessionContext } from "./types";

export function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim();
}

export async function requireParticipantSession(req: NextRequest): Promise<
  | { ok: true; context: ParticipantAppSessionContext }
  | { ok: false; response: ReturnType<typeof fail> }
> {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, response: fail("Missing participant session token", 401) };
  }

  if (!verifyParticipantSessionTokenShape(token)) {
    return { ok: false, response: fail("Invalid participant session token", 401) };
  }

  const tokenHash = hashParticipantSessionToken(token);

  const { data, error } = await supabaseAdmin
    .from("participant_app_sessions")
    .select("id, organisation_id, project_id, participant_id, device_id, platform, app_version, status, expires_at")
    .eq("session_token_hash", tokenHash)
    .single();

  if (error || !data) {
    return { ok: false, response: fail("Session not found", 401) };
  }

  if (data.status !== "active") {
    return { ok: false, response: fail("Session is not active", 401) };
  }

  if (new Date(data.expires_at).getTime() < Date.now()) {
    await supabaseAdmin
      .from("participant_app_sessions")
      .update({ status: "expired" })
      .eq("id", data.id);

    return { ok: false, response: fail("Session has expired", 401) };
  }

  await supabaseAdmin
    .from("participant_app_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    ok: true,
    context: {
      session_id: data.id,
      organisation_id: data.organisation_id,
      project_id: data.project_id,
      participant_id: data.participant_id,
      device_id: data.device_id,
      platform: data.platform,
      app_version: data.app_version,
    },
  };
}
