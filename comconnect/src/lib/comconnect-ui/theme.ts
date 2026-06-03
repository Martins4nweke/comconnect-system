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
    description: "Create SMS, WhatsApp, voice and app messages.",
    tag: "Core",
  },
  {
    title: "Scheduler",
    href: "/scheduler",
    description: "Schedule messages, reminders and campaigns.",
    tag: "Core",
  },
  {
    title: "Delivery Logs",
    href: "/delivery-logs",
    description: "Track sent, failed, queued and retried messages.",
    tag: "Core",
  },
  {
    title: "Inbox / Replies",
    href: "/inbox",
    description: "Participant replies, help requests and follow-up.",
    tag: "Core",
  },
  {
    title: "Templates",
    href: "/templates",
    description: "Reusable message and campaign templates.",
    tag: "Core",
  },
  {
    title: "Media Library",
    href: "/media-library",
    description: "Audio, video, image and document assets.",
    tag: "Core",
  },
];

const participants = [
  {
    title: "Participants",
    href: "/participants",
    description: "Manage people, codes, contacts and app access.",
    tag: "People",
  },
  {
    title: "Participant Groups",
    href: "/participant-groups",
    description: "Cohorts, study arms, clinics and care groups.",
    tag: "People",
  },
  {
    title: "Projects",
    href: "/projects",
    description: "Project setup, sites, modules and access.",
    tag: "People",
  },
  {
    title: "Organisations",
    href: "/organisations",
    description: "Client organisations and ownership settings.",
    tag: "People",
  },
  {
    title: "Team Members",
    href: "/team-members",
    description: "Research assistants, admins and care teams.",
    tag: "People",
  },
];

const researchCare = [
  {
    title: "Education Library",
    href: "/education-library",
    description: "Health education content and assignments.",
    tag: "Research",
  },
  {
    title: "Questionnaires",
    href: "/questionnaires",
    description: "Dynamic forms, bulk assignments and responses.",
    tag: "Research",
  },
  {
    title: "Consent Forms",
    href: "/consent-forms",
    description: "Versioned consent and audit records.",
    tag: "Research",
  },
  {
    title: "Health Check-ins",
    href: "/health-checkins",
    description: "BP, symptoms, adherence and observations.",
    tag: "Care",
  },
  {
    title: "Appointments",
    href: "/appointments",
    description: "Visits, calls and appointment reminders.",
    tag: "Care",
  },
  {
    title: "Referrals",
    href: "/referrals",
    description: "Referral queue, status and follow-up.",
    tag: "Care",
  },
  {
    title: "Chat",
    href: "/chat",
    description: "Participant-to-team conversation threads.",
    tag: "Care",
  },
];

const automationSafety = [
  {
    title: "Communication Operations",
    href: "/communication-operations",
    description: "Delivery flow, fallback and service status.",
    tag: "Ops",
  },
  {
    title: "Fallback Rules",
    href: "/fallback-rules",
    description: "App → push → SMS → voice logic.",
    tag: "Ops",
  },
  {
    title: "Push Queue",
    href: "/push-queue",
    description: "Privacy-safe app alerts.",
    tag: "Ops",
  },
  {
    title: "Voice Tasks",
    href: "/voice-tasks",
    description: "Voice call queue and retries.",
    tag: "Ops",
  },
];

const platformApi = [
  {
    title: "Developer API",
    href: "/app-api",
    description: "Participant app and commercial API console.",
    tag: "API",
  },
  {
    title: "API Keys",
    href: "/api-keys",
    description: "Create and manage external API access.",
    tag: "API",
  },
  {
    title: "Webhooks",
    href: "/webhooks",
    description: "Send delivery and reply events to clients.",
    tag: "API",
  },
  {
    title: "API Usage",
    href: "/api-usage",
    description: "Track requests, limits and billing usage.",
    tag: "API",
  },
  {
    title: "Billing",
    href: "/billing",
    description: "Plans, wallet, usage and payments.",
    tag: "Platform",
  },
  {
    title: "Audit Logs",
    href: "/audit-logs",
    description: "Security and activity trail.",
    tag: "Admin",
  },
  {
    title: "Project Settings",
    href: "/project-settings",
    description: "Project channels, modules and configuration.",
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
      description: "Health education content and assignments.",
      tag: "Research",
    },
    {
      title: "Questionnaires",
      href: "/questionnaires",
      description: "Dynamic forms, bulk assignments and responses.",
      tag: "Research",
    },
    {
      title: "Consent Forms",
      href: "/consent-forms",
      description: "Versioned consent and audit records.",
      tag: "Research",
    },
  ],

  care: [
    {
      title: "Health Check-ins",
      href: "/health-checkins",
      description: "Generic observation submissions.",
      tag: "Care",
    },
    {
      title: "Appointments",
      href: "/appointments",
      description: "Visits, calls and reminders.",
      tag: "Care",
    },
    {
      title: "Referrals",
      href: "/referrals",
      description: "Referral queue and follow-up.",
      tag: "Care",
    },
    {
      title: "Inbox / Help",
      href: "/inbox",
      description: "Help requests and alerts.",
      tag: "Care",
    },
    {
      title: "Chat",
      href: "/chat",
      description: "Participant-to-team messaging.",
      tag: "Care",
    },
  ],

  operations: [
    {
      title: "Communication Operations",
      href: "/communication-operations",
      description: "Delivery flow, fallback and service status.",
      tag: "Ops",
    },
    {
      title: "Push Queue",
      href: "/push-queue",
      description: "Privacy-safe app alerts.",
      tag: "Ops",
    },
    {
      title: "Fallback Rules",
      href: "/fallback-rules",
      description: "App → push → SMS → voice logic.",
      tag: "Ops",
    },
    {
      title: "Voice Tasks",
      href: "/voice-tasks",
      description: "Voice call queue and retries.",
      tag: "Ops",
    },
  ],
};