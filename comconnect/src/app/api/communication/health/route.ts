import { ok } from "@/lib/comconnect-core/api-response";

export async function GET() {
  return ok({
    service: "communication-delivery",
    status: "ready",
    providers: {
      push: process.env.PUSH_PROVIDER || "disabled",
      sms: process.env.SMS_PROVIDER || "disabled",
      voice: process.env.VOICE_PROVIDER || "disabled",
    },
    default_flow: ["app", "push", "sms", "voice"],
    whatsapp: "optional_not_enabled_by_default",
  });
}
