import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_PROJECT_MODULES } from "./constants";

export async function seedProjectModules(organisationId: string, projectId: string) {
  const rows = DEFAULT_PROJECT_MODULES.map((module) => ({
    organisation_id: organisationId,
    project_id: projectId,
    module_code: module.module_code,
    module_name: module.module_name,
    enabled: module.enabled,
    settings: {},
  }));

  const { error } = await supabaseAdmin
    .from("project_modules")
    .upsert(rows, { onConflict: "project_id,module_code" });

  if (error) throw new Error(`Failed to seed project modules: ${error.message}`);
}
