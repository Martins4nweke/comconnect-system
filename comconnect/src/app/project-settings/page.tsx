import { supabaseAdmin } from "@/lib/supabase/admin";
import { SimpleTable } from "@/components/comconnect-core/SimpleTable";

export const dynamic = "force-dynamic";

export default async function ProjectSettingsPage() {
  const { data: projects } = await supabaseAdmin
    .from("projects")
    .select("id, name, project_code, organisations(name), project_modules(module_code,module_name,enabled), project_channel_settings(*)")
    .order("created_at", { ascending: false });

  const rows =
    projects?.map((project: any) => ({
      ...project,
      enabledModules: (project.project_modules ?? [])
        .filter((m: any) => m.enabled)
        .map((m: any) => m.module_name)
        .join(", "),
      fallback: project.project_channel_settings?.[0]?.fallback_order ?? ["sms", "voice"],
    })) ?? [];

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl bg-[#FFF7F2] p-6">
          <h1 className="text-2xl font-bold text-slate-900">Project Settings</h1>
          <p className="mt-1 text-sm text-slate-600">
            View enabled modules and channel settings. Edit through API routes for now.
          </p>
        </section>

        <SimpleTable
          rows={rows}
          columns={[
            { key: "project", label: "Project", render: (row: any) => `${row.name} (${row.project_code})` },
            { key: "org", label: "Organisation", render: (row: any) => row.organisations?.name ?? "—" },
            { key: "modules", label: "Enabled Modules", render: (row: any) => row.enabledModules || "—" },
            { key: "fallback", label: "Fallback", render: (row: any) => Array.isArray(row.fallback) ? row.fallback.join(" → ") : "sms → voice" },
          ]}
        />
      </div>
    </main>
  );
}
