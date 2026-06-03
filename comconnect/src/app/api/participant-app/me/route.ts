import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/comconnect-core/api-response";
import { requireParticipantSession } from "@/lib/participant-app/auth";
import { getParticipantAppConfig } from "@/lib/participant-app/config";

export async function GET(req: NextRequest) {
  const auth = await requireParticipantSession(req);
  if (auth.ok === false) return auth.response;

  try {
    const config = await getParticipantAppConfig(auth.context);
    return ok(config);
  } catch (error: any) {
    return fail(error.message ?? "Failed to load participant app config", 500);
  }
}
