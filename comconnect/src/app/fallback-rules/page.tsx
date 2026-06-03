"use client";

import { LargeTableClient } from "@/components/comconnect-actions/LargeTableClient";
import { StatusPill } from "@/components/comconnect-ui/StatusPill";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

const config = {
  title: "Fallback Rules",
  subtitle: "Project-specific app → SMS → voice fallback rules with real status actions.",
  eyebrow: "Communication Operations",
  apiPath: "/api/large-table/fallback-rules",
  bulkApiPath: "/api/large-table/fallback-rules/bulk-action",
  parentHref: "/communication-operations",
  parentLabel: "Back to Communication Operations",
  breadcrumbs: [{ label: "Research + Care", href: "/research-care" }, { label: "Communication Operations", href: "/communication-operations" }, { label: "Fallback Rules" }],
  searchPlaceholder: "Search rule name/trigger...",
  allowBulkActions: true,
  statusOptions: ["active", "inactive", "archived"],
  columns: [
    { key: "name", label: "Name", render: (r: any) => r.name },
    { key: "trigger", label: "Trigger", render: (r: any) => r.trigger_event },
    { key: "status", label: "Status", render: (r: any) => <StatusPill value={r.status ?? (r.enabled ? "active" : "inactive")} /> },
    { key: "created", label: "Created", render: (r: any) => dt(r.created_at) },
  ],
};

export default function Page() {
  return <LargeTableClient config={config as any} />;
}

