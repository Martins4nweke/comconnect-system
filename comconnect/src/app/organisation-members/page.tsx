"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { VerticalAppShell } from "@/components/comconnect-ui/VerticalAppShell";

type CurrentContext = {
  organisation_id?: string | null;
  organisation_name?: string | null;
  organisation_role?: string | null;
  active_project_name?: string | null;
  project_role?: string | null;
  can_manage_projects?: boolean;
};

type OrganisationMember = {
  id?: string;
  organisation_id?: string;
  user_id?: string | null;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
  status?: string | null;
  created_at?: string | null;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function dateText(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

function statusClass(status?: string | null) {
  const value = cleanText(status).toLowerCase();

  if (value === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "inactive") return "border-slate-200 bg-slate-100 text-slate-600";
  if (value === "invited") return "border-orange-200 bg-orange-50 text-orange-700";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function roleLabel(role?: string | null) {
  return cleanText(role).replaceAll("_", " ") || "viewer";
}

function getRows(json: any): OrganisationMember[] {
  const data = json?.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.members)) return data.members;
  return [];
}

export default function OrganisationMembersPage() {
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [members, setMembers] = useState<OrganisationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");

  const canManage =
    ["superadmin", "organisation_admin", "org_admin", "admin"].includes(
      cleanText(context?.organisation_role).toLowerCase()
    );

  const organisationId = context?.organisation_id ?? "";

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) =>
      cleanText(a.email).localeCompare(cleanText(b.email))
    );
  }, [members]);

  async function loadContextAndMembers() {
    setLoading(true);
    setNote("");

    try {
      const contextResponse = await fetch("/api/context/current", {
        cache: "no-store",
      });

      const contextJson = await contextResponse.json().catch(() => null);

      if (!contextResponse.ok || !contextJson?.ok) {
        throw new Error(contextJson?.error ?? "Failed to load current context.");
      }

      const currentContext = contextJson.data as CurrentContext;
      setContext(currentContext);

      if (!currentContext.organisation_id) {
        throw new Error("No organisation found for this user.");
      }

      const params = new URLSearchParams();
      params.set("organisation_id", currentContext.organisation_id);

      const membersResponse = await fetch(
        `/api/organisation-members?${params.toString()}`,
        { cache: "no-store" }
      );

      const membersJson = await membersResponse.json().catch(() => null);

      if (!membersResponse.ok || !membersJson?.ok) {
        throw new Error(membersJson?.error ?? "Failed to load organisation members.");
      }

      setMembers(getRows(membersJson));
    } catch (error: any) {
      setNote(error?.message ?? "Failed to load organisation members.");
    } finally {
      setLoading(false);
    }
  }

  async function addMember(event: React.FormEvent) {
    event.preventDefault();

    if (!canManage) {
      setNote("You do not have permission to add organisation members.");
      return;
    }

    if (!organisationId) {
      setNote("No organisation context found.");
      return;
    }

    if (!cleanText(email)) {
      setNote("Email is required.");
      return;
    }

    setSaving(true);
    setNote("");

    try {
      const response = await fetch("/api/organisation-members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organisation_id: organisationId,
          email,
          full_name: fullName,
          role,
          status: "active",
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to add member.");
      }

      setFullName("");
      setEmail("");
      setRole("viewer");

      await loadContextAndMembers();
      setNote("Organisation member added.");
    } catch (error: any) {
      setNote(error?.message ?? "Failed to add member.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadContextAndMembers();
  }, []);

  return (
    <VerticalAppShell
      organisationRole={context?.organisation_role ?? "organisation_admin"}
      projectRole={context?.project_role ?? "project_manager"}
      organisationName={context?.organisation_name ?? "Current organisation"}
      projectName={context?.active_project_name ?? "Active project"}
    >
      <main className="px-4 py-4 lg:px-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F26A21]">
              Organisation Access
            </p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">
              Organisation Members
            </h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-600">
              Manage users who belong to {context?.organisation_name ?? "this organisation"}.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/projects"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21]"
            >
              Projects
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21]"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {note ? (
          <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm font-bold text-orange-800">
            {note}
          </div>
        ) : null}

        {canManage ? (
          <section className="mb-4 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <h2 className="text-base font-black text-slate-950">Add organisation member</h2>

            <form onSubmit={addMember} className="mt-3 grid gap-3 md:grid-cols-4">
              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">
                  Full name
                </span>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Jane Doe"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800"
                />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">
                  Email
                </span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="jane@example.com"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800"
                />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">
                  Role
                </span>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800"
                >
                  <option value="organisation_admin">Organisation admin</option>
                  <option value="billing_admin">Billing admin</option>
                  <option value="developer_admin">Developer admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl bg-[#F26A21] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Add member"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-950">Members</h2>
              <p className="text-xs font-semibold text-slate-500">
                {sortedMembers.length} member(s)
              </p>
            </div>

            <button
              type="button"
              onClick={loadContextAndMembers}
              disabled={loading}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:border-[#F26A21] hover:text-[#F26A21] disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
                  <th className="px-3 py-2 font-black">Name</th>
                  <th className="px-3 py-2 font-black">Email</th>
                  <th className="px-3 py-2 font-black">Role</th>
                  <th className="px-3 py-2 font-black">Status</th>
                  <th className="px-3 py-2 font-black">Added</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm font-bold text-slate-500">
                      Loading members...
                    </td>
                  </tr>
                ) : sortedMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm font-bold text-slate-500">
                      No organisation members found.
                    </td>
                  </tr>
                ) : (
                  sortedMembers.map((member, index) => (
                    <tr
                      key={member.id ?? member.email ?? index}
                      className="border-b border-slate-50 hover:bg-[#FFF7F2]"
                    >
                      <td className="px-3 py-3 font-black text-slate-900">
                        {member.full_name || "—"}
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-700">
                        {member.email || "—"}
                      </td>
                      <td className="px-3 py-3 font-bold capitalize text-slate-700">
                        {roleLabel(member.role)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full border px-2 py-1 text-xs font-black ${statusClass(
                            member.status
                          )}`}
                        >
                          {member.status || "unknown"}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-500">
                        {dateText(member.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </VerticalAppShell>
  );
}