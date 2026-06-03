import { supabaseAdmin } from "@/lib/supabase/admin";
import { SimpleTable } from "@/components/comconnect-core/SimpleTable";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { data: rows } = await supabaseAdmin
    .from("projects")
    .select("*, organisations(name)")
    .order("created_at", { ascending: false })
    ;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl bg-[#FFF7F2] p-6">
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-600">SUBProjects</p>
        </section>
        <SimpleTable
          rows={rows ?? []}
          columns={[
            { key: "name", label: "Project", render: (row: any) => row.name },
            { key: "code", label: "Code", render: (row: any) => row.project_code },
            { key: "org", label: "Organisation", render: (row: any) => row.organisations?.name ?? "—" },
            { key: "status", label: "Status", render: (row: any) => row.status },
            { key: "app", label: "App Access", render: (row: any) => row.app_access_enabled ? "Enabled" : "Disabled" },
          ]}
        />
      </div>
    </main>
  );
}
