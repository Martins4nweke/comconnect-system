export const comconnectTheme = {
  orange: "#FF5C1A",
  orangeSoft: "#FFF1EA",
  black: "#171717",
  softBg: "#EEF3FB",
  slate: "#0F172A",
  muted: "#64748B",
  white: "#FFFFFF",
};

/*
  mainDashboard is the clean, non-duplicated structure for the home dashboard.

  The older groups below are kept so existing pages such as:
  - /research-care
  - /research-care/research
  - /research-care/care
  - /communication-operations
  will not break.
*/

const coreCommunication = [
  {
    title: "Message Library",
    href: "/messages",
    description: "Create and manage messages.",
    tag: "Core",
  },
  {
    title: "Scheduler",
    href: "/scheduler",
    description: "Schedule project messages.",
    tag: "Core",
  },
  {
    title: "Delivery Logs",
    href: "/delivery-logs",
    description: "Delivery records.",
    tag: "Core",
  },
  {
    title: "Inbox / Replies",
    href: "/inbox",
    description: "Replies and help requests.",
    tag: "Core",
  },
  {
    title: "Templates",
    href: "/templates",
    description: "Reusable templates.",
    tag: "Core",
  },
  {
    title: "Media Library",
    href: "/media-library",
    description: "Media assets.",
    tag: "Core",
  },
];

const participants = [
  {
    title: "Participants",
    href: "/participants",
    description: "People, codes and contacts.",
    tag: "People",
  },
  {
    title: "Participant Groups",
    href: "/participant-groups",
    description: "Cohorts and groups.",
    tag: "People",
  },
  {
    title: "Projects",
    href: "/projects",
    description: "Project setup.",
    tag: "People",
  },
  {
    title: "Organisations",
    href: "/organisations",
    description: "Organisation settings.",
    tag: "People",
  },
  {
    title: "Team Members",
    href: "/team-members",
    description: "Team access.",
    tag: "People",
  },
];

const researchCare = [
  {
    title: "Education Library",
    href: "/education-library",
    description: "Education content.",
    tag: "Research",
  },
  {
    title: "Questionnaires",
    href: "/questionnaires",
    description: "Forms and responses.",
    tag: "Research",
  },
  {
    title: "Consent Forms",
    href: "/consent-forms",
    description: "Consent records.",
    tag: "Research",
  },
  {
    title: "Health Check-ins",
    href: "/health-checkins",
    description: "Health observations.",
    tag: "Care",
  },
  {
    title: "Appointments",
    href: "/appointments",
    description: "Visits and reminders.",
    tag: "Care",
  },
  {
    title: "Referrals",
    href: "/referrals",
    description: "Referral queue.",
    tag: "Care",
  },
  {
    title: "Chat",
    href: "/chat",
    description: "Participant chat.",
    tag: "Care",
  },
];

const automationSafety = [
  {
    title: "Communication Operations",
    href: "/communication-operations",
    description: "Fallback and queues.",
    tag: "Ops",
  },
  {
    title: "Push Queue",
    href: "/push-queue",
    description: "App alerts.",
    tag: "Ops",
  },
  {
    title: "Fallback Rules",
    href: "/fallback-rules",
    description: "Fallback flow.",
    tag: "Ops",
  },
  {
    title: "Voice Tasks",
    href: "/voice-tasks",
    description: "Voice queue.",
    tag: "Ops",
  },
  {
    title: "Delivery Logs",
    href: "/delivery-logs",
    description: "Delivery records.",
    tag: "Ops",
  },
  {
    title: "Export Center",
    href: "/export",
    description: "Export data.",
    tag: "Export",
  },
];

const platformApi = [
  {
    title: "Developer API",
    href: "/app-api",
    description: "API console.",
    tag: "API",
  },
  {
    title: "API Keys",
    href: "/api-keys",
    description: "API access.",
    tag: "API",
  },
  {
    title: "Webhooks",
    href: "/webhooks",
    description: "Event callbacks.",
    tag: "API",
  },
  {
    title: "API Usage",
    href: "/api-usage",
    description: "API activity.",
    tag: "API",
  },
  {
    title: "Billing",
    href: "/billing",
    description: "Plans and wallet.",
    tag: "Billing",
  },
  {
    title: "Projects",
    href: "/projects",
    description: "Project access.",
    tag: "Admin",
  },
  {
    title: "Project Settings",
    href: "/project-settings",
    description: "Project configuration.",
    tag: "Admin",
  },
  {
    title: "Organisation Members",
    href: "/organisation-members",
    description: "Organisation users.",
    tag: "Admin",
  },
  {
    title: "Project Members",
    href: "/project-members",
    description: "Project users.",
    tag: "Admin",
  },
  {
    title: "Audit Logs",
    href: "/audit-logs",
    description: "Activity trail.",
    tag: "Admin",
  },
];

export const moduleGroups = {
  /*
    Clean main dashboard groups.
    Use these on src/app/page.tsx.
  */
  mainDashboard: {
    coreCommunication,
    participants,
    researchCare,
    automationSafety,
    platformApi,
  },

  /*
    Direct group names for newer pages.
  */
  coreCommunication,
  participants,
  researchCare,
  automationSafety,
  platformApi,

  /*
    Backward-compatible groups for existing Research + Care pages.
    Do not delete yet.
  */
  research: [
    {
      title: "Education Library",
      href: "/education-library",
      description: "Education content.",
      tag: "Research",
    },
    {
      title: "Questionnaires",
      href: "/questionnaires",
      description: "Forms and responses.",
      tag: "Research",
    },
    {
      title: "Consent Forms",
      href: "/consent-forms",
      description: "Consent records.",
      tag: "Research",
    },
  ],

  care: [
    {
      title: "Health Check-ins",
      href: "/health-checkins",
      description: "Health observations.",
      tag: "Care",
    },
    {
      title: "Appointments",
      href: "/appointments",
      description: "Visits and reminders.",
      tag: "Care",
    },
    {
      title: "Referrals",
      href: "/referrals",
      description: "Referral queue.",
      tag: "Care",
    },
    {
      title: "Inbox / Help",
      href: "/inbox",
      description: "Help requests.",
      tag: "Care",
    },
    {
      title: "Chat",
      href: "/chat",
      description: "Participant chat.",
      tag: "Care",
    },
  ],

  operations: [
    {
      title: "Push Queue",
      href: "/push-queue",
      description: "App alerts.",
      tag: "Ops",
    },
    {
      title: "Fallback Rules",
      href: "/fallback-rules",
      description: "Fallback flow.",
      tag: "Ops",
    },
    {
      title: "Voice Tasks",
      href: "/voice-tasks",
      description: "Voice queue.",
      tag: "Ops",
    },
    {
      title: "Delivery Logs",
      href: "/delivery-logs",
      description: "Delivery records.",
      tag: "Ops",
    },
  ],
};