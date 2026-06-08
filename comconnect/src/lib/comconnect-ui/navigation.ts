import type { Permission } from "@/lib/comconnect-core/permissions";

export type NavigationItem = {
  title: string;
  href: string;
  description?: string;
  permission: Permission;
  tag?: string;
  superadminOnly?: boolean;
};

export type NavigationGroup = {
  title: string;
  items: NavigationItem[];
};

export const sidebarNavigation: NavigationGroup[] = [
  {
    title: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        description: "Main ComConnect overview.",
        permission: "dashboard:read",
        tag: "Home",
      },
    ],
  },
  {
    title: "Core Communication",
    items: [
      {
        title: "Participants",
        href: "/participants",
        description: "Participant registry, search, groups and segmentation.",
        permission: "participants:read",
        tag: "Core",
      },
      {
        title: "Messages",
        href: "/messages",
        description: "Message library, message creation and sending.",
        permission: "messages:read",
        tag: "Core",
      },
      {
        title: "Scheduler",
        href: "/scheduler",
        description: "Schedule messages and manage due communication.",
        permission: "scheduler:read",
        tag: "Core",
      },
      {
        title: "Central Inbox",
        href: "/inbox",
        description: "Replies, help requests, IVR replies and voice recordings.",
        permission: "inbox:read",
        tag: "Inbox",
      },
      {
        title: "Chat",
        href: "/chat",
        description: "Two-way participant chat, text, audio, photo and video.",
        permission: "chat:read",
        tag: "Chat",
      },
      {
        title: "Delivery Logs",
        href: "/delivery-logs",
        description: "App, push, SMS, WhatsApp and voice delivery logs.",
        permission: "delivery_logs:read",
        tag: "Logs",
      },
      {
        title: "Voice Tasks",
        href: "/voice-tasks",
        description: "Voice call queue, retries, IVR and call status.",
        permission: "voice:read",
        tag: "Voice",
      },
      {
        title: "Communication Operations",
        href: "/communication-operations",
        description: "Delivery flow, fallback rules and service status.",
        permission: "delivery_logs:read",
        tag: "Ops",
      },
      {
        title: "Fallback Rules",
        href: "/fallback-rules",
        description: "App → push → SMS → voice fallback logic.",
        permission: "scheduler:read",
        tag: "Ops",
      },
      {
        title: "Push Queue",
        href: "/push-queue",
        description: "Privacy-safe app push notification queue.",
        permission: "scheduler:read",
        tag: "Push",
      },
    ],
  },
  {
    title: "Research Module",
    items: [
      {
        title: "Education Library",
        href: "/education-library",
        description: "Education messages, health content and media assignments.",
        permission: "education:read",
        tag: "Research",
      },
      {
        title: "Questionnaires",
        href: "/questionnaires",
        description: "Questionnaire builder, assignments and responses.",
        permission: "questionnaires:read",
        tag: "Research",
      },
      {
        title: "Consent Forms",
        href: "/consent-forms",
        description: "Participant consent records and consent workflows.",
        permission: "consent:read",
        tag: "Research",
      },
      {
        title: "Media Library",
        href: "/media-library",
        description: "Images, audio, videos and media URLs for projects.",
        permission: "media:read",
        tag: "Media",
      },
    ],
  },
  {
    title: "Care Module",
    items: [
      {
        title: "Health Check-ins",
        href: "/health-checkins",
        description: "BP readings, observations and participant health updates.",
        permission: "health:read",
        tag: "Care",
      },
      {
        title: "Appointments",
        href: "/appointments",
        description: "Appointment scheduling, reminders and responses.",
        permission: "appointments:read",
        tag: "Care",
      },
      {
        title: "Referrals",
        href: "/referrals",
        description: "Referral queue, follow-up and care escalation.",
        permission: "referrals:read",
        tag: "Care",
      },
    ],
  },
  {
    title: "Data and Reporting",
    items: [
      {
        title: "Export Center",
        href: "/export",
        description: "Download Excel, CSV, PDF summaries and media ZIP files.",
        permission: "export:read",
        tag: "Export",
      },
      {
        title: "Audit Logs",
        href: "/audit-logs",
        description: "Security, user activity and system audit trail.",
        permission: "audit:read",
        tag: "Audit",
      },
    ],
  },
  {
    title: "Developer and Admin",
    items: [
            {
        title: "Developer API",
        href: "/app-api",
        description: "Participant app and commercial API console.",
        permission: "api:read",
        tag: "API",
      },
      {
        title: "API Use Cases",
        href: "/api-use-cases",
        description:
          "Plain-language API use cases for hospitals, universities and NGOs.",
        permission: "api:read",
        tag: "API",
      },
      {
        title: "API Keys",
        href: "/api-keys",
        description: "Create and manage external API access.",
        permission: "api:manage",
        tag: "API",
      },
      {
        title: "Billing",
        href: "/billing",
        description: "Plans, wallet, usage and payments.",
        permission: "billing:read",
        tag: "Billing",
      },
      {
        title: "Billing Review",
        href: "/admin/billing-review",
        description:
          "Superadmin receipt review, plan activation and wallet approval.",
        permission: "billing:manage",
        tag: "Admin",
        superadminOnly: true,
      },
      {
        title: "Billing Settings",
        href: "/admin/billing-settings",
        description:
          "Configure SMS, voice and WhatsApp wallet deduction prices.",
        permission: "billing:manage",
        tag: "Admin",
        superadminOnly: true,
      },
      {
        title: "Projects",
        href: "/projects",
        description: "Create and manage projects within an organisation.",
        permission: "project:read",
        tag: "Admin",
      },
      {
        title: "Project Settings",
        href: "/project-settings",
        description: "Project channels, modules and configuration.",
        permission: "settings:read",
        tag: "Admin",
      },
      {
        title: "Organisation Members",
        href: "/organisation-members",
        description: "Manage organisation users, roles and access.",
        permission: "organisation:manage",
        tag: "Admin",
      },
      {
        title: "Project Members",
        href: "/project-team",
        description: "Manage project team access and project roles.",
        permission: "project:manage",
        tag: "Admin",
      },
    ],
  },
];

export function filterNavigationByPermission(params: {
  organisationRole?: string | null;
  projectRole?: string | null;
  can: (permission: Permission) => boolean;
}) {
  return sidebarNavigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const role = String(params.organisationRole ?? "")
          .trim()
          .toLowerCase();

        const isSuperadmin =
          role === "platform_owner" || role === "superadmin";

        if (item.superadminOnly && !isSuperadmin) {
          return false;
        }

        return params.can(item.permission);
      }),
    }))
    .filter((group) => group.items.length > 0);
}