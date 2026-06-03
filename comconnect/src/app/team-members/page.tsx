import { supabaseAdmin } from "@/lib/supabase/admin";
import { SimpleTable } from "@/components/comconnect-core/SimpleTable";

export const dynamic = "force-dynamic";

export default async function TeamMembersPage() {
  const { data: organisationMembers } = await supabaseAdmin
    .from("organisation_members")
    .select("*, organisations(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: projectMembers } = await supabaseAdmin
    .from("project_members")
    .select("*, projects(name, project_code), organisations(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl bg-[#FFF7F2] p-6">
          <h1 className="text-2xl font-bold text-slate-900">Team Members</h1>
          <p className="mt-1 text-sm text-slate-600">
            Organisation and project-level staff access for ComConnect Core.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Organisation Members</h2>
          <SimpleTable
            rows={organisationMembers ?? []}
            columns={[
              { key: "name", label: "Name", render: (row: any) => row.full_name ?? "—" },
              { key: "email", label: "Email", render: (row: any) => row.email ?? "—" },
              { key: "org", label: "Organisation", render: (row: any) => row.organisations?.name ?? "—" },
              { key: "role", label: "Role", render: (row: any) => row.role },
              { key: "status", label: "Status", render: (row: any) => row.status },
            ]}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Project Members</h2>
          <SimpleTable
            rows={projectMembers ?? []}
            columns={[
              { key: "name", label: "Name", render: (row: any) => row.full_name ?? "—" },
              { key: "email", label: "Email", render: (row: any) => row.email ?? "—" },
              { key: "project", label: "Project", render: (row: any) => row.projects?.name ?? "—" },
              { key: "role", label: "Role", render: (row: any) => row.role },
              { key: "status", label: "Status", render: (row: any) => row.status },
            ]}
          />
        </section>
      </div>
    </main>
  );
}
