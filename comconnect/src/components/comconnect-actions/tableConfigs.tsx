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
  subtitle: "Search, add, message, schedule and manage project participants.",
  eyebrow: "Core registry",
  apiPath: "/api/large-table/participants",
  bulkApiPath: "/api/large-table/participants/bulk-action",
  parentHref: "/",
  parentLabel: "Dashboard",
  breadcrumbs: [{ label: "Dashboard", href: "/" }, { label: "Participants" }],
  searchPlaceholder: "Search code, phone or name...",
  allowBulkActions: true,
  statusOptions: ["active", "inactive", "withdrawn", "completed", "archived"],
  columns: [
    { key: "code", label: "Code", render: (r) => r.participant_code },
    {
      key: "name",
      label: "Name",
      render: (r) =>
        r.participant_label ??
        r.metadata?.display_name ??
        r.display_name ??
        (`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "—"),
    },
    { key: "phone", label: "Phone", render: (r) => r.phone_number ?? "—" },
    {
      key: "channel",
      label: "Channel",
      render: (r) => r.preferred_channel ?? r.metadata?.preferred_channel ?? "app",
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
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21]"
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
          className="rounded-lg border border-slate-200 bg-[#FFF7F2] px-2 py-1 text-xs font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21]"
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
          className="rounded-lg border border-slate-200 bg-[#FFF7F2] px-2 py-1 text-xs font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21]"
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
    subtitle:
      "Create, review and manage participant referrals, follow-up status and care escalation.",
    eyebrow: "Care module",
    apiPath: "/api/large-table/referrals",
    bulkApiPath: "/api/large-table/referrals/bulk-action",
    parentHref: "/research-care/care",
    parentLabel: "Back to Care",
    breadcrumbs: [
      { label: "Research + Care", href: "/research-care" },
      { label: "Care", href: "/research-care/care" },
      { label: "Referrals" },
    ],
    searchPlaceholder:
      "Search participant, reason, referral type, priority or status...",
    allowBulkActions: true,
    statusOptions: [
      "new",
      "under_review",
      "follow_up_scheduled",
      "participant_not_ready",
      "contacted",
      "completed",
      "archived",
    ],
    columns: [
      {
        key: "participant",
        label: "Participant",
        render: (r) => (
          <div>
            <p className="font-black text-slate-800">
              {r.participant_label ??
                r.participants?.metadata?.display_name ??
                r.participants?.participant_code ??
                "—"}
            </p>
            <p className="text-xs font-bold text-slate-500">
              {r.participant_code ?? r.participants?.participant_code ?? "—"}
            </p>
          </div>
        ),
      },
      {
        key: "referral",
        label: "Referral",
        render: (r) => (
          <div>
            <p className="font-black text-slate-800">
              {text(r.referral_label ?? r.reason, 70)}
            </p>
            <p className="text-xs font-bold text-slate-500">
              {r.referral_type ?? "general"}
            </p>
          </div>
        ),
      },
      {
        key: "priority",
        label: "Priority",
        render: (r) => <StatusPill value={r.priority} />,
      },
      {
        key: "status",
        label: "Status",
        render: (r) => <StatusPill value={r.status} />,
      },
      {
        key: "follow",
        label: "Follow-up",
        render: (r) => dt(r.follow_up_at ?? r.follow_up_label),
      },
      {
        key: "created",
        label: "Created",
        render: (r) => dt(r.created_at),
      },
    ],
  },

  inbox: {
    title: "Participant Response Inbox",
    subtitle:
      "Central operational queue for message replies, chat, help requests, questionnaire submissions, appointment responses, health check-ins and referral responses.",
    eyebrow: "Core Communication Engine",
    apiPath: "/api/large-table/inbox",
    bulkApiPath: "/api/large-table/inbox/bulk-action",
    parentHref: "/communication-operations",
    parentLabel: "Back to Communication Operations",
    breadcrumbs: [
      { label: "Communication Operations", href: "/communication-operations" },
      { label: "Participant Response Inbox" },
    ],
    searchPlaceholder:
      "Search participant, reply type, title, summary, source or status...",
    allowBulkActions: true,
    statusOptions: ["open", "assigned", "resolved", "archived"],
    columns: [
      {
        key: "participant",
        label: "Participant",
        render: (r) => (
          <div>
            <p className="font-black text-slate-800">
              {r.participant_label ??
                r.participants?.display_name ??
                r.participants?.participant_code ??
                "—"}
            </p>
            <p className="text-xs font-bold text-slate-500">
              {r.participants?.participant_code ?? "—"}
            </p>
          </div>
        ),
      },
      {
        key: "type",
        label: "Type",
        render: (r) => (
          <div>
            <p className="font-black text-slate-800">
              {r.response_type ?? r.source_type ?? "Inbox item"}
            </p>
            <p className="text-xs font-bold text-slate-500">
              {r.response_module ?? "Inbox"}
            </p>
          </div>
        ),
      },
      {
        key: "title",
        label: "Source",
        render: (r) => (
          <div>
            <p className="font-black text-slate-800">{text(r.title, 50)}</p>
            <p className="text-xs font-bold text-slate-500">
              {r.source_type ?? "—"}
            </p>
          </div>
        ),
      },
      {
        key: "summary",
        label: "Preview",
        render: (r) => text(r.summary, 90),
      },
      {
        key: "priority",
        label: "Priority",
        render: (r) => <StatusPill value={r.priority} />,
      },
      {
        key: "status",
        label: "Status",
        render: (r) => <StatusPill value={r.status} />,
      },
      {
        key: "open",
        label: "Open",
        render: (r) => (
          <Link
            href={r.action_href ?? "/inbox"}
            className="rounded-lg border border-slate-300 bg-[#FFF7F2] px-2 py-1 text-xs font-black text-slate-700 hover:border-[#171717]"
          >
            Open
          </Link>
        ),
      },
      {
        key: "created",
        label: "Created",
        render: (r) => dt(r.created_at),
      },
    ],
  },

    appointments: {
    title: "Appointments",
    subtitle:
      "Create, review and manage participant appointments, reminders and responses.",
    eyebrow: "Care module",
    apiPath: "/api/large-table/appointments",
    bulkApiPath: "/api/large-table/appointments/bulk-action",
    parentHref: "/research-care/care",
    parentLabel: "Back to Care",
    breadcrumbs: [
      { label: "Research + Care", href: "/research-care" },
      { label: "Care", href: "/research-care/care" },
      { label: "Appointments" },
    ],
    searchPlaceholder: "Search title, participant, location, type or status...",
    allowBulkActions: true,
    statusOptions: [
      "scheduled",
      "confirmed",
      "reschedule_requested",
      "cancelled",
      "completed",
      "missed",
      "archived",
    ],
    columns: [
      {
        key: "participant",
        label: "Participant",
        render: (r) => (
          <div>
            <p className="font-black text-slate-800">
              {r.participant_label ??
                r.participants?.metadata?.display_name ??
                r.participants?.participant_code ??
                "—"}
            </p>
            <p className="text-xs font-bold text-slate-500">
              {r.participant_code ?? r.participants?.participant_code ?? "—"}
            </p>
          </div>
        ),
      },
      {
        key: "appointment",
        label: "Appointment",
        render: (r) => (
          <div>
            <p className="font-black text-slate-800">
              {text(r.appointment_label ?? r.title, 60)}
            </p>
            <p className="text-xs font-bold text-slate-500">
              {r.appointment_type ?? "follow_up"}
            </p>
          </div>
        ),
      },
      {
        key: "start",
        label: "Date/Time",
        render: (r) => dt(r.start_at ?? r.appointment_time_label),
      },
      {
        key: "location",
        label: "Location",
        render: (r) => text(r.location, 40),
      },
      {
        key: "status",
        label: "Status",
        render: (r) => <StatusPill value={r.status} />,
      },
      {
        key: "created",
        label: "Created",
        render: (r) => dt(r.created_at),
      },
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
    subtitle: "Project-aware forms, assignments and response tracking.",
    eyebrow: "Research module",
    apiPath: "/api/large-table/questionnaires",
    bulkApiPath: "/api/large-table/questionnaires/bulk-action",
    parentHref: "/research-care/research",
    parentLabel: "Back to Research",
    breadcrumbs: [
      { label: "Research + Care", href: "/research-care" },
      { label: "Research", href: "/research-care/research" },
      { label: "Questionnaires" },
    ],
    searchPlaceholder: "Search title, description, status or version...",
    allowBulkActions: true,
    statusOptions: ["draft", "ready", "published", "archived"],
    columns: [
      {
        key: "title",
        label: "Title",
        render: (r) => (
          <div>
            <p className="font-black text-slate-800">{text(r.title, 60)}</p>
            <p className="text-xs font-bold text-slate-500">
              {r.questionnaire_type ?? r.settings?.questionnaire_type ?? "custom"}
            </p>
          </div>
        ),
      },
      {
        key: "project",
        label: "Project",
        render: (r) => (
          <div>
            <p className="font-black text-slate-800">
              {r.project_name ?? r.projects?.name ?? "—"}
            </p>
            <p className="text-xs font-bold text-slate-500">
              {r.project_code ?? r.projects?.project_code ?? "—"}
            </p>
          </div>
        ),
      },
      {
        key: "version",
        label: "Version",
        render: (r) => r.version_label ?? "v1.0",
      },
      {
        key: "language",
        label: "Language",
        render: (r) => r.language ?? "en",
      },
      {
        key: "offline",
        label: "Offline",
        render: (r) =>
          r.offline_label ??
          (r.settings?.allow_offline_completion ? "yes" : "no"),
      },
      {
        key: "status",
        label: "Status",
        render: (r) => <StatusPill value={r.status} />,
      },
      {
        key: "published",
        label: "Published",
        render: (r) => dt(r.published_at),
      },
      {
        key: "created",
        label: "Created",
        render: (r) => dt(r.created_at),
      },
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
    subtitle: "Review participant BP readings, symptoms, adherence updates and other health observations.",
    eyebrow: "Care module",
    apiPath: "/api/large-table/health-observations",
    bulkApiPath: "/api/large-table/health-observations/bulk-action",
    parentHref: "/research-care/care",
    parentLabel: "Back to Care",
    breadcrumbs: [
      { label: "Research + Care", href: "/research-care" },
      { label: "Care", href: "/research-care/care" },
      { label: "Health Check-ins" },
    ],
    searchPlaceholder: "Search observation code, severity, alert or status...",
    allowBulkActions: true,
    statusOptions: ["active", "reviewed", "resolved", "archived"],
    columns: [
      {
        key: "participant",
        label: "Participant",
        render: (r) => (
          <div>
            <p className="font-black text-slate-800">
              {r.participant_label ??
                r.participants?.metadata?.display_name ??
                r.participants?.participant_code ??
                "—"}
            </p>
            <p className="text-xs font-bold text-slate-500">
              {r.participant_code ?? r.participants?.participant_code ?? "—"}
            </p>
          </div>
        ),
      },
      {
        key: "observation",
        label: "Observation",
        render: (r) => (
          <div>
            <p className="font-black text-slate-800">
              {r.observation_type_label ?? r.observation_code ?? "—"}
            </p>
            <p className="text-xs font-bold text-slate-500">
              {r.observation_type_code ?? r.observation_code ?? "—"}
            </p>
          </div>
        ),
      },
      {
        key: "severity",
        label: "Severity",
        render: (r) => <StatusPill value={r.severity} />,
      },
      {
        key: "alert",
        label: "Alert",
        render: (r) => <StatusPill value={r.alert_status} />,
      },
      {
        key: "status",
        label: "Status",
        render: (r) => <StatusPill value={r.status} />,
      },
      {
        key: "submitted",
        label: "Submitted",
        render: (r) => dt(r.submitted_at ?? r.submitted_label ?? r.created_at),
      },
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
    subtitle: "Read-only security and activity trail for the active organisation and project.",
    eyebrow: "Admin",
    apiPath: "/api/large-table/audit-logs",
    parentHref: "/",
    parentLabel: "Back to Dashboard",
    breadcrumbs: [
      { label: "Dashboard", href: "/" },
      { label: "Audit Logs" },
    ],
    searchPlaceholder: "Search action, actor, entity or event...",
    allowBulkActions: false,
    statusOptions: [],
    columns: [
      {
        key: "time",
        label: "Time",
        render: (r) => dt(r.created_at),
      },
      {
        key: "actor",
        label: "Actor",
        render: (r) => (
          <div>
            <p className="font-black text-slate-800">
              {r.actor_label ?? r.actor_type ?? "—"}
            </p>
            <p className="text-xs font-bold text-slate-500">
              {r.actor_type ?? "—"}
            </p>
          </div>
        ),
      },
      {
        key: "action",
        label: "Action",
        render: (r) => (
          <div>
            <p className="font-black text-slate-800">
              {r.audit_label ?? r.action ?? "Audit event"}
            </p>
            <p className="text-xs font-bold text-slate-500">
              {r.action ?? "—"}
            </p>
          </div>
        ),
      },
      {
        key: "entity",
        label: "Entity",
        render: (r) => (
          <div>
            <p className="font-black text-slate-800">
              {r.entity_label ?? r.entity_type ?? "—"}
            </p>
            <p className="text-xs font-bold text-slate-500">
              {r.entity_id ?? "—"}
            </p>
          </div>
        ),
      },
      {
        key: "project",
        label: "Project",
        render: (r) => r.project_id ?? "—",
      },
    ],
  },
};