import { supabaseAdmin } from "@/lib/supabase/admin";
import { SimpleTable } from "@/components/comconnect-core/SimpleTable";

export const dynamic = "force-dynamic";

export default async function OrganisationsPage() {
  const { data: rows } = await supabaseAdmin
    .from("organisations")
    .select("*")
    .order("created_at", { ascending: false })
    ;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl bg-[#FFF7F2] p-6">
          <h1 className="text-2xl font-bold text-slate-900">Organisations</h1>
          <p className="mt-1 text-sm text-slate-600">SUBOrganisations</p>
        </section>
        <SimpleTable
          rows={rows ?? []}
          columns={[
            { key: "name", label: "Name", render: (row: any) => row.name },
            { key: "slug", label: "Slug", render: (row: any) => row.slug ?? "—" },
            { key: "status", label: "Status", render: (row: any) => row.status },
            { key: "support", label: "Support", render: (row: any) => row.support_email ?? row.support_phone ?? "—" },
            { key: "created", label: "Created", render: (row: any) => new Date(row.created_at).toLocaleDateString() },
          ]}
        />
      </div>
    </main>
  );
}
