export type JsonRecord = Record<string, unknown>;
export type AuditActorType = "system" | "dashboard_user" | "participant" | "api_client";

export type AuditLogInput = {
  organisation_id?: string | null;
  project_id?: string | null;
  actor_user_id?: string | null;
  actor_type?: AuditActorType;
  actor_label?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: JsonRecord;
};
