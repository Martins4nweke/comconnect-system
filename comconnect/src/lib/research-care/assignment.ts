import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssignmentTarget } from "./types";

export async function validateAssignmentTarget(projectId: string, target: AssignmentTarget) {
  if (!target.participant_id && !target.group_id) {
    throw new Error("participant_id or group_id is required");
  }

  if (target.participant_id) {
    const { data, error } = await supabaseAdmin
      .from("participants")
      .select("id")
      .eq("id", target.participant_id)
      .eq("project_id", projectId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("participant_id does not belong to this project");
  }

  if (target.group_id) {
    const { data, error } = await supabaseAdmin
      .from("participant_groups")
      .select("id")
      .eq("id", target.group_id)
      .eq("project_id", projectId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("group_id does not belong to this project");
  }
}
