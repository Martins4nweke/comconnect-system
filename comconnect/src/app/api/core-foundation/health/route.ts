import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_PROJECT_MODULES } from "@/lib/comconnect-core/constants";
import { ok, fail } from "@/lib/comconnect-core/api-response";

export async function GET() {
  const checks: Record<string, boolean> = {};
  const tables = [
    "organisations",
    "organisation_members",
    "projects",
    "project_members",
    "project_modules",
    "participants",
    "participant_groups",
    "participant_group_memberships",
    "project_channel_settings",
    "audit_logs",
  ];

  for (const table of tables) {
    const { error } = await supabaseAdmin.from(table).select("id").limit(1);
    checks[table] = !error;
    if (error) {
      return fail(`Core foundation check failed at table: ${table}`, 500, {
        table,
        message: error.message,
        checks,
      });
    }
  }

  return ok({
    ready: true,
    checks,
    default_module_count: DEFAULT_PROJECT_MODULES.length,
    phase: "phase_1_core_foundation",
    next_phase: "participant_app_api_foundation",
  });
}
