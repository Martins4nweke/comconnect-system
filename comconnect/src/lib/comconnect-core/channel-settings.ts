import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_CHANNEL_SETTINGS } from "./constants";

export async function ensureProjectChannelSettings(organisationId: string, projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("project_channel_settings")
    .upsert(
      { organisation_id: organisationId, project_id: projectId, ...DEFAULT_CHANNEL_SETTINGS },
      { onConflict: "project_id" }
    )
    .select("*")
    .single();

  if (error) throw new Error(`Failed to ensure channel settings: ${error.message}`);
  return data;
}

export function normaliseFallbackOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return ["sms", "voice"];
  const allowed = new Set(["sms", "voice", "whatsapp", "email"]);
  const cleaned = value.filter((item) => typeof item === "string" && allowed.has(item));
  return cleaned.length ? cleaned : ["sms", "voice"];
}
