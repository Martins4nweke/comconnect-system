import { ok } from "@/lib/comconnect-core/api-response";

export async function GET() {
  return ok({
    phase: "2",
    service: "participant-app-api",
    status: "ready",
    requires: ["Phase 1 V4 Core Foundation"],
    endpoints: [
      "/api/participant-app/login",
      "/api/participant-app/logout",
      "/api/participant-app/me",
      "/api/participant-app/devices/register",
      "/api/participant-app/sync/pull",
      "/api/participant-app/sync/push",
    ],
  });
}
