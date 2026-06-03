"use client";

import Link from "next/link";
import { LargeTableClient } from "@/components/comconnect-actions/LargeTableClient";
import { StatusPill } from "@/components/comconnect-ui/StatusPill";

function dt(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

const config = {
  title: "Chat Threads",
  subtitle:
    "Controlled participant-to-study-team chat threads with conversation view and reply actions.",
  eyebrow: "Research + Care",
  apiPath: "/api/large-table/chat",
  bulkApiPath: "/api/large-table/chat/bulk-action",
  parentHref: "/research-care/care",
  parentLabel: "Back to Care",
  breadcrumbs: [
    { label: "Research + Care", href: "/research-care" },
    { label: "Care", href: "/research-care/care" },
    { label: "Chat" },
  ],
  searchPlaceholder: "Search subject...",
  allowBulkActions: true,
  statusOptions: ["open", "closed", "archived"],
  columns: [
    {
      key: "participant",
      label: "Participant",
      render: (r: any) => r.participants?.participant_code ?? "—",
    },
    {
      key: "subject",
      label: "Subject",
      render: (r: any) => r.subject ?? "Participant message",
    },
    {
      key: "conversation",
      label: "Conversation",
      render: (r: any) => (
        <Link
          href={`/chat/${r.id}`}
          className="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-[#F26A21] hover:bg-[#FFF7F2]"
        >
          Open conversation →
        </Link>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: any) => <StatusPill value={r.status} />,
    },
    {
      key: "last",
      label: "Last message",
      render: (r: any) => dt(r.last_message_at),
    },
  ],
};

export default function Page() {
  return <LargeTableClient config={config as any} />;
}