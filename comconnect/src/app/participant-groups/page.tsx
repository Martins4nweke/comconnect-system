"use client";

import { LargeTableClient } from "@/components/comconnect-actions/LargeTableClient";
import { StatusPill } from "@/components/comconnect-ui/StatusPill";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

const config = {
  title: "Participant Groups",
  subtitle: "Project-aware segmentation for assignments, interventions and follow-up.",
  eyebrow: "Core registry",
  apiPath: "/api/large-table/participant-groups",
  bulkApiPath: "/api/large-table/participant-groups/bulk-action",
  parentHref: "/research-care",
  parentLabel: "Back to Research + Care",
  breadcrumbs: [{ label: "Research + Care", href: "/research-care" }, { label: "Participant Groups" }],
  searchPlaceholder: "Search group...",
  allowBulkActions: true,
  statusOptions: ["active", "inactive", "archived"],
  columns: [
    { key: "name", label: "Name", render: (r: any) => r.name },
    { key: "code", label: "Code", render: (r: any) => r.code ?? "—" },
    { key: "status", label: "Status", render: (r: any) => <StatusPill value={r.status} /> },
    { key: "created", label: "Created", render: (r: any) => dt(r.created_at) },
  ],
};

export default function Page() {
  return <LargeTableClient config={config as any} />;
}

