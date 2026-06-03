export type ProjectRole =
  | "project_manager"
  | "research_assistant"
  | "follow_up_officer"
  | "clinician"
  | "nurse"
  | "data_manager"
  | "developer"
  | "viewer"
  | "auditor";

const rolePermissions: Record<ProjectRole, string[]> = {
  project_manager: ["*"],
  research_assistant: ["project:read", "participants:read", "participants:write"],
  follow_up_officer: ["project:read", "participants:read"],
  clinician: ["project:read", "participants:read"],
  nurse: ["project:read", "participants:read"],
  data_manager: ["project:read", "participants:read", "audit:read"],
  developer: ["project:read", "settings:read"],
  viewer: ["project:read", "participants:read"],
  auditor: ["project:read", "audit:read"],
};

export function projectRoleCan(role: ProjectRole, permission: string) {
  const permissions = rolePermissions[role] ?? [];
  return permissions.includes("*") || permissions.includes(permission);
}
