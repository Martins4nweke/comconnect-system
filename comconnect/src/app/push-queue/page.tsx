"use client";

import { LargeTableClient } from "@/components/comconnect-actions/LargeTableClient";
import { StatusPill } from "@/components/comconnect-ui/StatusPill";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

const config = {
  title: "Push Queue",
  subtitle: "Privacy-safe app notification queue with status actions.",
  eyebrow: "Communication Operations",
  apiPath: "/api/large-table/push-queue",
  bulkApiPath: "/api/large-table/push-queue/bulk-action",
  parentHref: "/communication-operations",
  parentLabel: "Back to Communication Operations",
  breadcrumbs: [{ label: "Research + Care", href: "/research-care" }, { label: "Communication Operations", href: "/communication-operations" }, { label: "Push Queue" }],
  searchPlaceholder: "Search push title/body...",
  allowBulkActions: true,
  statusOptions: ["pending", "sent", "failed", "cancelled"],
  columns: [
    { key: "title", label: "Title", render: (r: any) => r.title },
    { key: "body", label: "Body", render: (r: any) => r.body },
    { key: "status", label: "Status", render: (r: any) => <StatusPill value={r.status} /> },
    { key: "scheduled", label: "Scheduled", render: (r: any) => dt(r.scheduled_for) },
  ],
};

export default function Page() {
  return <LargeTableClient config={config as any} />;
}

