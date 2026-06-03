"use client";

import Link from "next/link";
import { StatusPill } from "@/components/comconnect-ui/StatusPill";

export type LargeTableColumn = {
  key: string;
  label: string;
  render: (row: any) => React.ReactNode;
};

export type LargeTableConfig = {
  title: string;
  subtitle: string;
  eyebrow: string;
  apiPath: string;
  bulkApiPath?: string;
  parentHref: string;
  parentLabel: string;
  breadcrumbs: { label: string; href?: string }[];
  columns: LargeTableColumn[];
  statusOptions: string[];
  searchPlaceholder: string;
  allowBulkActions: boolean;
};

function dt(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function text(value?: string | null, max = 80) {
  if (!value) return "—";
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export const tableConfigs: Record<string, LargeTableConfig> = {
  participants: {
    title: "Participants",
    subtitle: "Large-scale participant registry with search, filters, pagination, selection and bulk archive.",
    eyebrow: "Core registry",
    apiPath: "/api/large-table/participants",
    bulkApiPath: "/api/large-table/participants/bulk-action",
    parentHref: "/research-care",
    parentLabel: "Back to Research + Care",
    breadcrumbs: [{ label: "Research + Care", href: "/research-care" }, { label: "Participants" }],
    searchPlaceholder: "Search code, phone, name...",
    allowBulkActions: true,
    statusOptions: ["active", "inactive", "withdrawn", "completed", "archived"],
   columns: [
  { key: "code", label: "Code", render: (r) => r.participant_code },
  {
    key: "name",
    label: "Name",
    render: (r) =>
      r.metadata?.display_name ??
      r.display_name ??
      (`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "—"),
  },
  { key: "phone", label: "Phone", render: (r) => r.phone_number ?? "—" },
  {
    key: "channel",
    label: "Channel",
    render: (r) => r.metadata?.preferred_channel ?? "app",
  },
  {
    key: "quiet",
    label: "Quiet time",
    render: (r) =>
      r.metadata?.quiet_time_enabled === false
        ? "Off"
        : `${r.metadata?.quiet_time_start ?? "20:00"}–${
            r.metadata?.quiet_time_end ?? "07:00"
          }`,
  },
  {
    key: "status",
    label: "Status",
    render: (r) => <StatusPill value={r.status} />,
  },
  {
    key: "app",
    label: "App",
    render: (r) => (r.app_access_enabled ? "Enabled" : "Disabled"),
  },
  {
    key: "edit",
    label: "Edit",
    render: (r) => (
      <Link
        href={`/participants/${r.id}/edit`}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-black text-slate-700 hover:border-[#171717]"
      >
        Edit
      </Link>
    ),
  },
  {
    key: "message",
    label: "Message",
    render: (r) => (
      <Link
        href={`/messages?participant_id=${r.id}&participant_code=${encodeURIComponent(
          r.participant_code ?? ""
        )}`}
        className="rounded-lg border border-slate-300 bg-[#FFF7F2] px-2 py-1 text-xs font-black text-slate-700 hover:border-[#171717]"
      >
        Message
      </Link>
    ),
  },
  {
    key: "schedule",
    label: "Schedule",
    render: (r) => (
      <Link
        href={`/scheduler?participant_id=${r.id}&participant_code=${encodeURIComponent(
          r.participant_code ?? ""
        )}`}
        className="rounded-lg border border-slate-300 bg-[#FFF7F2] px-2 py-1 text-xs font-black text-slate-700 hover:border-[#171717]"
      >
        Schedule
      </Link>
    ),
  },
  { key: "created", label: "Created", render: (r) => dt(r.created_at) },
],
  },
  referrals: {
    title: "Referrals",
    subtitle: "Compact referral queue with assignment, status update, pagination and bulk archive.",
    eyebrow: "Care module",
    apiPath: "/api/large-table/referrals",
    bulkApiPath: "/api/large-table/referrals/bulk-action",
    parentHref: "/research-care/care",
    parentLabel: "Back to Care",
    breadcrumbs: [{ label: "Research + Care", href: "/research-care" }, { label: "Care", href: "/research-care/care" }, { label: "Referrals" }],
    searchPlaceholder: "Search reason or referral type...",
    allowBulkActions: true,
    statusOptions: ["new", "under_review", "follow_up_scheduled", "participant_not_ready", "contacted", "completed", "archived"],
    columns: [
      { key: "type", label: "Type", render: (r) => r.referral_type },
      { key: "reason", label: "Reason", render: (r) => text(r.reason) },
      { key: "priority", label: "Priority", render: (r) => <StatusPill value={r.priority} /> },
      { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
      { key: "follow", label: "Follow-up", render: (r) => dt(r.follow_up_at) },
      { key: "created", label: "Created", render: (r) => dt(r.created_at) },
    ],
  },
  inbox: {
    title: "Inbox / Help Requests",
    subtitle: "Central operational queue for participant replies, help requests and alerts.",
    eyebrow: "Research + Care",
    apiPath: "/api/large-table/inbox",
    bulkApiPath: "/api/large-table/inbox/bulk-action",
    parentHref: "/research-care/care",
    parentLabel: "Back to Care",
    breadcrumbs: [{ label: "Research + Care", href: "/research-care" }, { label: "Care", href: "/research-care/care" }, { label: "Inbox" }],
    searchPlaceholder: "Search title, summary, source...",
    allowBulkActions: true,
    statusOptions: ["open", "assigned", "resolved", "archived"],
    columns: [
      { key: "title", label: "Title", render: (r) => r.title },
      { key: "summary", label: "Summary", render: (r) => text(r.summary) },
      { key: "priority", label: "Priority", render: (r) => <StatusPill value={r.priority} /> },
      { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
      { key: "created", label: "Created", render: (r) => dt(r.created_at) },
    ],
  },
  appointments: {
    title: "Appointments",
    subtitle: "Project-aware appointment queue with pagination, filters and bulk actions.",
    eyebrow: "Care module",
    apiPath: "/api/large-table/appointments",
    bulkApiPath: "/api/large-table/appointments/bulk-action",
    parentHref: "/research-care/care",
    parentLabel: "Back to Care",
    breadcrumbs: [{ label: "Research + Care", href: "/research-care" }, { label: "Care", href: "/research-care/care" }, { label: "Appointments" }],
    searchPlaceholder: "Search title, location, type...",
    allowBulkActions: true,
    statusOptions: ["scheduled", "confirmed", "reschedule_requested", "cancelled", "completed", "missed", "archived"],
    columns: [
      { key: "title", label: "Title", render: (r) => r.title },
      { key: "type", label: "Type", render: (r) => r.appointment_type },
      { key: "start", label: "Start", render: (r) => dt(r.start_at) },
      { key: "location", label: "Location", render: (r) => r.location ?? "—" },
      { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
    ],
  },
  education: {
    title: "Education Library",
    subtitle: "Versioned low-data video, audio and text education content.",
    eyebrow: "Research module",
    apiPath: "/api/large-table/education",
    bulkApiPath: "/api/large-table/education/bulk-action",
    parentHref: "/research-care/research",
    parentLabel: "Back to Research",
    breadcrumbs: [{ label: "Research + Care", href: "/research-care" }, { label: "Research", href: "/research-care/research" }, { label: "Education Library" }],
    searchPlaceholder: "Search title, description, category...",
    allowBulkActions: true,
    statusOptions: ["draft", "published", "archived"],
    columns: [
      { key: "title", label: "Title", render: (r) => r.title },
      { key: "category", label: "Category", render: (r) => r.category ?? "—" },
      { key: "language", label: "Language", render: (r) => r.language },
      { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
      { key: "published", label: "Published", render: (r) => dt(r.published_at) },
    ],
  },
  questionnaires: {
    title: "Questionnaires",
    subtitle: "Dynamic project-specific forms and response tracking.",
    eyebrow: "Research module",
    apiPath: "/api/large-table/questionnaires",
    bulkApiPath: "/api/large-table/questionnaires/bulk-action",
    parentHref: "/research-care/research",
    parentLabel: "Back to Research",
    breadcrumbs: [{ label: "Research + Care", href: "/research-care" }, { label: "Research", href: "/research-care/research" }, { label: "Questionnaires" }],
    searchPlaceholder: "Search questionnaire title...",
    allowBulkActions: true,
    statusOptions: ["draft", "published", "archived"],
    columns: [
      { key: "title", label: "Title", render: (r) => r.title },
      { key: "version", label: "Version", render: (r) => r.version_label },
      { key: "language", label: "Language", render: (r) => r.language },
      { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
      { key: "published", label: "Published", render: (r) => dt(r.published_at) },
    ],
  },
  consent: {
    title: "Consent Forms",
    subtitle: "Version-controlled consent forms and audit-ready consent tracking.",
    eyebrow: "Research module",
    apiPath: "/api/large-table/consent-forms",
    bulkApiPath: "/api/large-table/consent-forms/bulk-action",
    parentHref: "/research-care/research",
    parentLabel: "Back to Research",
    breadcrumbs: [{ label: "Research + Care", href: "/research-care" }, { label: "Research", href: "/research-care/research" }, { label: "Consent Forms" }],
    searchPlaceholder: "Search consent forms...",
    allowBulkActions: true,
    statusOptions: ["draft", "published", "archived"],
    columns: [
      { key: "title", label: "Title", render: (r) => r.title },
      { key: "language", label: "Language", render: (r) => r.language },
      { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
      { key: "created", label: "Created", render: (r) => dt(r.created_at) },
    ],
  },
  observations: {
    title: "Health Check-ins",
    subtitle: "Generic condition-neutral observations and project check-ins.",
    eyebrow: "Care module",
    apiPath: "/api/large-table/health-observations",
    bulkApiPath: "/api/large-table/health-observations/bulk-action",
    parentHref: "/research-care/care",
    parentLabel: "Back to Care",
    breadcrumbs: [{ label: "Research + Care", href: "/research-care" }, { label: "Care", href: "/research-care/care" }, { label: "Health Check-ins" }],
    searchPlaceholder: "Search observation code...",
    allowBulkActions: true,
    statusOptions: ["active", "reviewed", "resolved", "archived"],
    columns: [
      { key: "code", label: "Code", render: (r) => r.observation_code },
      { key: "severity", label: "Severity", render: (r) => <StatusPill value={r.severity} /> },
      { key: "alert", label: "Alert", render: (r) => r.alert_status },
      { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
      { key: "submitted", label: "Submitted", render: (r) => dt(r.submitted_at) },
    ],
  },
  voice: {
    title: "Voice Tasks",
    subtitle: "Voice call task queue for fallback and urgent participant follow-up.",
    eyebrow: "Communication operations",
    apiPath: "/api/large-table/voice-tasks",
    bulkApiPath: "/api/large-table/voice-tasks/bulk-action",
    parentHref: "/communication-operations",
    parentLabel: "Back to Communication Operations",
    breadcrumbs: [{ label: "Research + Care", href: "/research-care" }, { label: "Communication Operations", href: "/communication-operations" }, { label: "Voice Tasks" }],
    searchPlaceholder: "Search reason or phone...",
    allowBulkActions: true,
    statusOptions: ["pending", "assigned", "completed", "failed", "cancelled"],
    columns: [
      { key: "reason", label: "Reason", render: (r) => text(r.reason) },
      { key: "phone", label: "Phone", render: (r) => r.phone_number ?? "—" },
      { key: "priority", label: "Priority", render: (r) => <StatusPill value={r.priority} /> },
      { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
      { key: "scheduled", label: "Scheduled", render: (r) => dt(r.scheduled_for) },
    ],
  },
  audit: {
    title: "Audit Logs",
    subtitle: "Read-only audit trail with server-side search and pagination.",
    eyebrow: "Audit",
    apiPath: "/api/large-table/audit-logs",
    parentHref: "/research-care",
    parentLabel: "Back to Research + Care",
    breadcrumbs: [{ label: "Research + Care", href: "/research-care" }, { label: "Audit Logs" }],
    searchPlaceholder: "Search action, actor, entity...",
    allowBulkActions: false,
    statusOptions: [],
    columns: [
      { key: "time", label: "Time", render: (r) => dt(r.created_at) },
      { key: "actor", label: "Actor", render: (r) => r.actor_label ?? r.actor_type },
      { key: "action", label: "Action", render: (r) => r.action },
      { key: "entity", label: "Entity", render: (r) => r.entity_type ?? "—" },
    ],
  },
};
