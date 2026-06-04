export type OrganisationRole =
  | "superadmin"
  | "organisation_admin"
  | "billing_admin"
  | "developer_admin"
  | "viewer";

export type ProjectRole =
  | "project_manager"
  | "research_assistant"
  | "follow_up_officer"
  | "care_officer"
  | "clinician"
  | "nurse"
  | "data_manager"
  | "developer"
  | "viewer"
  | "auditor";

export type Permission =
  | "*"
  | "dashboard:read"

  // Project and organisation
  | "organisation:read"
  | "organisation:manage"
  | "project:read"
  | "project:manage"
  | "settings:read"
  | "settings:write"

  // Core communication
  | "participants:read"
  | "participants:write"
  | "messages:read"
  | "messages:write"
  | "scheduler:read"
  | "scheduler:write"
  | "inbox:read"
  | "inbox:write"
  | "chat:read"
  | "chat:write"
  | "delivery_logs:read"
  | "voice:read"
  | "voice:write"

  // Research module
  | "education:read"
  | "education:write"
  | "questionnaires:read"
  | "questionnaires:write"
  | "consent:read"
  | "consent:write"
  | "media:read"
  | "media:write"

  // Care module
  | "health:read"
  | "health:write"
  | "appointments:read"
  | "appointments:write"
  | "referrals:read"
  | "referrals:write"
  | "help_requests:read"
  | "help_requests:write"

  // Data/admin/developer
  | "export:read"
  | "audit:read"
  | "api:read"
  | "api:manage"
  | "webhooks:read"
  | "webhooks:manage"
  | "billing:read"
  | "billing:manage"
  | "users:read"
  | "users:manage";

export const organisationRolePermissions: Record<
  OrganisationRole,
  Permission[]
> = {
  superadmin: ["*"],

  organisation_admin: [
    "dashboard:read",
    "organisation:read",
    "organisation:manage",
    "project:read",
    "project:manage",
    "settings:read",
    "settings:write",
    "participants:read",
    "participants:write",
    "messages:read",
    "messages:write",
    "scheduler:read",
    "scheduler:write",
    "inbox:read",
    "inbox:write",
    "chat:read",
    "chat:write",
    "delivery_logs:read",
    "voice:read",
    "voice:write",
    "education:read",
    "education:write",
    "questionnaires:read",
    "questionnaires:write",
    "consent:read",
    "consent:write",
    "media:read",
    "media:write",
    "health:read",
    "health:write",
    "appointments:read",
    "appointments:write",
    "referrals:read",
    "referrals:write",
    "help_requests:read",
    "help_requests:write",
    "export:read",
    "audit:read",
    "api:read",
    "api:manage",
    "webhooks:read",
    "webhooks:manage",
    "billing:read",
    "billing:manage",
    "users:read",
    "users:manage",
  ],

  billing_admin: [
    "dashboard:read",
    "organisation:read",
    "project:read",
    "billing:read",
    "billing:manage",
    "audit:read",
  ],

  developer_admin: [
    "dashboard:read",
    "organisation:read",
    "project:read",
    "settings:read",
    "api:read",
    "api:manage",
    "webhooks:read",
    "webhooks:manage",
    "delivery_logs:read",
    "audit:read",
  ],

  viewer: [
    "dashboard:read",
    "organisation:read",
    "project:read",
  ],
};

export const projectRolePermissions: Record<ProjectRole, Permission[]> = {
  project_manager: ["*"],

  research_assistant: [
    "dashboard:read",
    "project:read",
    "participants:read",
    "participants:write",
    "messages:read",
    "messages:write",
    "scheduler:read",
    "scheduler:write",
    "inbox:read",
    "chat:read",
    "chat:write",
    "education:read",
    "education:write",
    "questionnaires:read",
    "questionnaires:write",
    "consent:read",
    "consent:write",
    "media:read",
    "media:write",
    "delivery_logs:read",
  ],

  follow_up_officer: [
    "dashboard:read",
    "project:read",
    "participants:read",
    "inbox:read",
    "inbox:write",
    "chat:read",
    "chat:write",
    "appointments:read",
    "appointments:write",
    "referrals:read",
    "referrals:write",
    "help_requests:read",
    "help_requests:write",
  ],

  care_officer: [
    "dashboard:read",
    "project:read",
    "participants:read",
    "inbox:read",
    "inbox:write",
    "chat:read",
    "chat:write",
    "health:read",
    "health:write",
    "appointments:read",
    "appointments:write",
    "referrals:read",
    "referrals:write",
    "help_requests:read",
    "help_requests:write",
    "delivery_logs:read",
  ],

  clinician: [
    "dashboard:read",
    "project:read",
    "participants:read",
    "inbox:read",
    "chat:read",
    "health:read",
    "health:write",
    "appointments:read",
    "appointments:write",
    "referrals:read",
    "referrals:write",
  ],

  nurse: [
    "dashboard:read",
    "project:read",
    "participants:read",
    "inbox:read",
    "chat:read",
    "health:read",
    "health:write",
    "appointments:read",
    "appointments:write",
    "help_requests:read",
    "help_requests:write",
  ],

  data_manager: [
    "dashboard:read",
    "project:read",
    "participants:read",
    "messages:read",
    "scheduler:read",
    "inbox:read",
    "chat:read",
    "education:read",
    "questionnaires:read",
    "consent:read",
    "media:read",
    "health:read",
    "appointments:read",
    "referrals:read",
    "delivery_logs:read",
    "voice:read",
    "export:read",
    "audit:read",
  ],

  developer: [
    "dashboard:read",
    "project:read",
    "settings:read",
    "api:read",
    "webhooks:read",
    "delivery_logs:read",
    "audit:read",
  ],

  viewer: [
    "dashboard:read",
    "project:read",
    "participants:read",
    "messages:read",
    "scheduler:read",
    "inbox:read",
    "chat:read",
    "education:read",
    "questionnaires:read",
    "health:read",
    "appointments:read",
    "referrals:read",
    "delivery_logs:read",
  ],

  auditor: [
    "dashboard:read",
    "project:read",
    "participants:read",
    "delivery_logs:read",
    "export:read",
    "audit:read",
  ],
};

export function organisationRoleCan(
  role: OrganisationRole | string | null | undefined,
  permission: Permission
) {
  if (!role) return false;

  const permissions =
    organisationRolePermissions[role as OrganisationRole] ?? [];

  return permissions.includes("*") || permissions.includes(permission);
}

export function projectRoleCan(
  role: ProjectRole | string | null | undefined,
  permission: Permission
) {
  if (!role) return false;

  const permissions = projectRolePermissions[role as ProjectRole] ?? [];

  return permissions.includes("*") || permissions.includes(permission);
}

export function userCan(params: {
  organisationRole?: OrganisationRole | string | null;
  projectRole?: ProjectRole | string | null;
  permission: Permission;
}) {
  return (
    organisationRoleCan(params.organisationRole, params.permission) ||
    projectRoleCan(params.projectRole, params.permission)
  );
}