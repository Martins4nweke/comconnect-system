import { ok } from "@/lib/comconnect-core/api-response";

export async function GET() {
  return ok({
    phase: "3",
    service: "research-care-module-foundation",
    status: "ready",
    requires: ["Phase 1 V4", "Phase 2 V3"],
    modules: [
      "education",
      "questionnaires",
      "consent",
      "health_checkins",
      "appointments",
      "referrals",
      "help_requests",
      "chat",
      "push_queue",
      "fallback_rules",
    ],
  });
}
