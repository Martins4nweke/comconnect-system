import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AuditLogInput } from "./types";

export async function createAuditLog(input: AuditLogInput) {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    organisation_id: input.organisation_id ?? null,
    project_id: input.project_id ?? null,
    actor_user_id: input.actor_user_id ?? null,
    actor_type: input.actor_type ?? "system",
    actor_label: input.actor_label ?? null,
    action: input.action,
    entity_type: input.entity_type ?? null,
    entity_id: input.entity_id ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) console.error("Failed to write audit log:", error.message);
}
