import { supabaseAdmin } from "@/lib/supabase/admin";

export async function getProjectOrganisation(projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, organisation_id")
    .eq("id", projectId)
    .single();

  if (error || !data) {
    throw new Error("Project not found");
  }

  return data;
}

export async function ensureModuleEnabled(projectId: string, moduleCode: string) {
  const { data, error } = await supabaseAdmin
    .from("project_modules")
    .select("enabled")
    .eq("project_id", projectId)
    .eq("module_code", moduleCode)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check module access: ${error.message}`);
  }

  if (!data || !data.enabled) {
    throw new Error(`Module is not enabled for this project: ${moduleCode}`);
  }

  return true;
}

export async function verifyParticipantInProject(participantId: string, projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("participants")
    .select("id, organisation_id, project_id, phone_number")
    .eq("id", participantId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Participant not found in this project");
  return data;
}
