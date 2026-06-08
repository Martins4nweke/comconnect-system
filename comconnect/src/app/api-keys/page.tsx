"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { VerticalAppShell } from "@/components/comconnect-ui/VerticalAppShell";
import { userCan } from "@/lib/comconnect-core/permissions";

export const dynamic = "force-dynamic";

type ApiKeyRow = {
  id: string;
  organisation_id: string;
  project_id: string | null;
  name: string;
  key_prefix: string;
  status: string;
  scopes: string[];
  created_by: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

type CurrentContext = {
  user?: {
    email?: string | null;
    id?: string | null;
  };
  organisation_id?: string | null;
  organisation_name?: string | null;
  organisation_role?: string | null;
  organisation_membership_status?: string | null;
  active_project_id?: string | null;
  active_project_name?: string | null;
  project_role?: string | null;
  allowed_projects?: any[];
  onboarding_required?: boolean;
  access_pending?: boolean;
  dev_fallback?: boolean;
};

const apiScopeOptions = [
  {
    scope: "participants:read",
    label: "Read participants",
    description: "Allow external systems to list/search participants.",
    group: "Participants",
  },
  {
    scope: "participants:write",
    label: "Create participants",
    description: "Allow external systems to create participant records.",
    group: "Participants",
  },
  {
    scope: "messages:read",
    label: "Read messages",
    description: "Reserved for future message library reading.",
    group: "Messages",
  },
  {
    scope: "messages:write",
    label: "Send/accept messages",
    description:
      "Allow external systems to create app messages or queue push/SMS/voice/WhatsApp through guarded workflows.",
    group: "Messages",
  },
  {
    scope: "schedules:read",
    label: "Read schedules",
    description: "Reserved for future schedule reading.",
    group: "Schedules",
  },
  {
    scope: "schedules:write",
    label: "Create schedules",
    description: "Allow external systems to create guarded communication schedules.",
    group: "Schedules",
  },
  {
    scope: "delivery_logs:read",
    label: "Read delivery logs",
    description: "Allow external systems to read scoped delivery outcomes.",
    group: "Monitoring",
  },
  {
    scope: "replies:read",
    label: "Read replies/help requests",
    description: "Allow external systems to read scoped reply/help-request records.",
    group: "Monitoring",
  },
  {
    scope: "webhooks:read",
    label: "Read webhooks",
    description: "Reserved for future webhook configuration reading.",
    group: "Webhooks",
  },
  {
    scope: "webhooks:write",
    label: "Test/manage webhooks",
    description: "Allow external systems to test configured webhook endpoints.",
    group: "Webhooks",
  },
];

const scopePresets = [
  {
    name: "Read-only",
    description: "Safe monitoring and participant lookup.",
    scopes: ["participants:read", "delivery_logs:read", "replies:read"],
  },
  {
    name: "Participant management",
    description: "Read and create participants, plus monitoring.",
    scopes: [
      "participants:read",
      "participants:write",
      "delivery_logs:read",
      "replies:read",
    ],
  },
  {
    name: "Messaging integration",
    description: "Create participants, schedules and message requests.",
    scopes: [
      "participants:read",
      "participants:write",
      "messages:write",
      "schedules:write",
      "delivery_logs:read",
      "replies:read",
    ],
  },
  {
    name: "Full integration",
    description: "All currently supported external API permissions.",
    scopes: [
      "participants:read",
      "participants:write",
      "messages:write",
      "schedules:write",
      "delivery_logs:read",
      "replies:read",
      "webhooks:write",
    ],
  },
];

const defaultScopes = ["participants:read", "delivery_logs:read"];

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function uniqueScopes(scopes: string[]) {
  return Array.from(new Set(scopes)).filter((scope) =>
    apiScopeOptions.some((option) => option.scope === scope)
  );
}

function AccessMessage({
  title,
  message,
  href,
  linkText,
}: {
  title: string;
  message: string;
  href?: string;
  linkText?: string;
}) {
  return (
    <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-[#0A5278]">
        Access check
      </p>
      <h2 className="mt-3 text-2xl font-black text-[#06324A]">{title}</h2>
      <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[#536271]">
        {message}
      </p>

      {href && linkText ? (
        <Link
          href={href}
          className="mt-5 inline-flex rounded-full bg-[#0A5278] px-5 py-3 text-sm font-black text-white hover:bg-[#063E5E]"
        >
          {linkText}
        </Link>
      ) : null}
    </div>
  );
}

export default function ApiKeysPage() {
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);

  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(defaultScopes);
  const [createdKey, setCreatedKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const canManageApiKeys = useMemo(() => {
    return userCan({
      organisationRole: context?.organisation_role ?? null,
      projectRole: context?.project_role ?? null,
      permission: "api:manage",
    });
  }, [context?.organisation_role, context?.project_role]);

  const groupedScopes = useMemo(() => {
    return apiScopeOptions.reduce<Record<string, typeof apiScopeOptions>>(
      (groups, option) => {
        if (!groups[option.group]) groups[option.group] = [];
        groups[option.group].push(option);
        return groups;
      },
      {}
    );
  }, []);

  function toggleScope(scope: string) {
    setSelectedScopes((current) => {
      if (current.includes(scope)) {
        return current.filter((item) => item !== scope);
      }

      return uniqueScopes([...current, scope]);
    });
  }

  function applyPreset(scopes: string[]) {
    setSelectedScopes(uniqueScopes(scopes));
  }

  function selectAllScopes() {
    setSelectedScopes(apiScopeOptions.map((option) => option.scope));
  }

  function clearScopes() {
    setSelectedScopes([]);
  }

  async function loadContextAndApiKeys() {
    setContextLoading(true);
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const contextResponse = await fetch("/api/context/current", {
        cache: "no-store",
      });

      const contextJson = await contextResponse.json().catch(() => null);

      if (!contextResponse.ok || !contextJson?.ok) {
        throw new Error(
          contextJson?.error ?? "Failed to load organisation/project context."
        );
      }

      const currentContext = contextJson.data as CurrentContext;
      setContext(currentContext);

      const allowed = userCan({
        organisationRole: currentContext.organisation_role ?? null,
        projectRole: currentContext.project_role ?? null,
        permission: "api:manage",
      });

      if (
        currentContext.onboarding_required ||
        currentContext.access_pending ||
        !currentContext.organisation_id ||
        !allowed
      ) {
        setApiKeys([]);
        return;
      }

      const res = await fetch("/api/api-keys", {
        method: "GET",
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load API keys.");
      }

      setApiKeys(json.data?.api_keys ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load API keys.");
    } finally {
      setContextLoading(false);
      setLoading(false);
    }
  }

  async function loadApiKeys() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (!context?.organisation_id) {
        setApiKeys([]);
        return;
      }

      if (!canManageApiKeys) {
        setApiKeys([]);
        return;
      }

      const res = await fetch("/api/api-keys", {
        method: "GET",
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load API keys.");
      }

      setApiKeys(json.data?.api_keys ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load API keys.");
    } finally {
      setLoading(false);
    }
  }

  async function createApiKey() {
    setCreating(true);
    setError("");
    setMessage("");
    setCreatedKey("");

    try {
      if (!canManageApiKeys) {
        throw new Error("You are not allowed to manage API keys.");
      }

      const cleanName = name.trim();

      if (!cleanName) {
        throw new Error("Enter a name for this API key.");
      }

      const cleanScopes = uniqueScopes(selectedScopes);

      if (cleanScopes.length === 0) {
        throw new Error("Select at least one API scope.");
      }

      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cleanName,
          scopes: cleanScopes,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to create API key.");
      }

      setCreatedKey(json.data?.key ?? "");
      setMessage(json.data?.message ?? "API key created.");
      setName("");
      setSelectedScopes(defaultScopes);
      await loadApiKeys();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create API key.");
    } finally {
      setCreating(false);
    }
  }

  async function copyCreatedKey() {
    setError("");
    setMessage("");

    try {
      await navigator.clipboard.writeText(createdKey);
      setMessage("API key copied to clipboard.");
    } catch {
      setError("Could not copy API key. Please highlight and copy it manually.");
    }
  }

  async function revokeApiKey(apiKeyId: string) {
    const confirmed = window.confirm(
      "Revoke this API key? This cannot be used again after revocation."
    );

    if (!confirmed) return;

    setRevokingId(apiKeyId);
    setError("");
    setMessage("");

    try {
      if (!canManageApiKeys) {
        throw new Error("You are not allowed to manage API keys.");
      }

      const res = await fetch("/api/api-keys", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key_id: apiKeyId,
          action: "revoke",
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to revoke API key.");
      }

      setMessage(json.data?.message ?? "API key revoked.");
      await loadApiKeys();
    } catch (err: any) {
      setError(err?.message ?? "Failed to revoke API key.");
    } finally {
      setRevokingId("");
    }
  }

  async function deleteApiKey(apiKeyId: string) {
    const confirmed = window.confirm(
      "Delete this API key record permanently? Revoking is safer for audit history. Continue only if you really want to remove it."
    );

    if (!confirmed) return;

    setDeletingId(apiKeyId);
    setError("");
    setMessage("");

    try {
      if (!canManageApiKeys) {
        throw new Error("You are not allowed to manage API keys.");
      }

      const res = await fetch(
        `/api/api-keys?api_key_id=${encodeURIComponent(apiKeyId)}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to delete API key.");
      }

      setMessage(json.data?.message ?? "API key deleted.");
      await loadApiKeys();
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete API key.");
    } finally {
      setDeletingId("");
    }
  }

  useEffect(() => {
    loadContextAndApiKeys();
  }, []);

  const organisationName =
    context?.organisation_name ?? "ComConnect Organisation";
  const projectName = context?.active_project_name ?? "API Management";
  const organisationRole = context?.organisation_role ?? "viewer";
  const projectRole = context?.project_role ?? "viewer";

  let guardedContent = null;

  if (contextLoading) {
    guardedContent = (
      <div className="rounded-[2rem] bg-white p-8 text-center text-sm font-black text-[#536271] shadow-sm">
        Loading API key access...
      </div>
    );
  } else if (context?.onboarding_required || !context?.organisation_id) {
    guardedContent = (
      <AccessMessage
        title="No active organisation"
        message="This account is not linked to an active organisation. API keys can only be managed after organisation access is active."
        href="/dashboard"
        linkText="Back to dashboard"
      />
    );
  } else if (context?.access_pending) {
    guardedContent = (
      <AccessMessage
        title="Organisation access pending"
        message="Your organisation access is still pending. API keys will become available after your membership is active."
        href="/dashboard"
        linkText="Back to dashboard"
      />
    );
  } else if (!canManageApiKeys) {
    guardedContent = (
      <AccessMessage
        title="You do not have API key permission"
        message="Only users with API management permission can create, revoke or delete API keys. Ask an organisation admin or developer admin to update your access."
        href="/dashboard"
        linkText="Back to dashboard"
      />
    );
  } else {
    guardedContent = (
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] bg-[#032A3D] p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#28A9E0]">
            API Keys
          </p>

          <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                Manage external API access
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/80">
                Create, copy once, revoke and delete organisation-scoped API
                keys for approved integrations. Select only the scopes each
                integration needs.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                Backend status
              </p>
              <p className="mt-2 text-xl font-black text-white">
                Connected to /api/api-keys
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-white/70">
                Full keys are shown only once after creation. Only key hashes
                are stored.
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700">
            {message}
          </div>
        ) : null}

        {createdKey ? (
          <section className="rounded-[2rem] border border-orange-200 bg-orange-50 p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">
              Copy now
            </p>
            <h2 className="mt-3 text-2xl font-black text-[#06324A]">
              New API key
            </h2>
            <p className="mt-2 text-sm font-bold text-[#536271]">
              This full key will not be shown again. Copy it before leaving this
              page.
            </p>

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
              <code className="block flex-1 overflow-x-auto rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#06324A]">
                {createdKey}
              </code>

              <button
                type="button"
                onClick={copyCreatedKey}
                className="rounded-full bg-[#0A5278] px-5 py-3 text-sm font-black text-white hover:bg-[#063E5E]"
              >
                Copy key
              </button>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
              Create API key
            </p>
            <h2 className="mt-3 text-2xl font-black text-[#06324A]">
              New key
            </h2>

            <label className="mt-5 block text-sm font-black text-[#06324A]">
              Key name
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Example: University integration"
              className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
            />

            <div className="mt-5 rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
                    Scope presets
                  </p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[#536271]">
                    Choose a preset, then adjust individual permissions below.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllScopes}
                    className="rounded-full border border-[#C9D8E4] bg-white px-3 py-2 text-xs font-black text-[#06324A] hover:bg-[#EAF2F8]"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={clearScopes}
                    className="rounded-full border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-700 hover:bg-red-50"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {scopePresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset.scopes)}
                    className="rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-left hover:bg-[#F7FBFD]"
                  >
                    <span className="block text-sm font-black text-[#06324A]">
                      {preset.name}
                    </span>
                    <span className="mt-1 block text-xs font-bold leading-5 text-[#536271]">
                      {preset.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {Object.entries(groupedScopes).map(([group, options]) => (
                <div
                  key={group}
                  className="rounded-2xl border border-[#C9D8E4] bg-white p-4"
                >
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
                    {group}
                  </p>

                  <div className="mt-3 grid gap-2">
                    {options.map((option) => {
                      const checked = selectedScopes.includes(option.scope);

                      return (
                        <label
                          key={option.scope}
                          className={[
                            "flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3",
                            checked
                              ? "border-[#0A5278] bg-[#EAF2F8]"
                              : "border-[#C9D8E4] bg-white",
                          ].join(" ")}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleScope(option.scope)}
                            className="mt-1 h-4 w-4"
                          />
                          <span>
                            <span className="block text-sm font-black text-[#06324A]">
                              {option.label}
                            </span>
                            <code className="mt-1 block text-xs font-black text-[#0A5278]">
                              {option.scope}
                            </code>
                            <span className="mt-1 block text-xs font-bold leading-5 text-[#536271]">
                              {option.description}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
                Selected scopes
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedScopes.length === 0 ? (
                  <span className="text-sm font-bold text-red-700">
                    No scopes selected.
                  </span>
                ) : (
                  selectedScopes.map((scope) => (
                    <span
                      key={scope}
                      className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#06324A]"
                    >
                      {scope}
                    </span>
                  ))
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={createApiKey}
              disabled={creating}
              className="mt-5 rounded-full bg-[#0A5278] px-6 py-3 text-sm font-black text-white hover:bg-[#063E5E] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create API key"}
            </button>
          </div>

          <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
                  Existing keys
                </p>
                <h2 className="mt-3 text-2xl font-black text-[#06324A]">
                  API keys
                </h2>
              </div>

              <button
                type="button"
                onClick={loadApiKeys}
                disabled={loading}
                className="rounded-full border border-[#C9D8E4] bg-white px-5 py-3 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[860px] border-separate border-spacing-y-2 text-left text-sm">
                <thead>
                  <tr className="text-xs font-black uppercase tracking-[0.16em] text-[#536271]">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Prefix</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Scopes</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2">Last used</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] px-4 py-5 text-center font-bold text-[#536271]"
                      >
                        Loading API keys...
                      </td>
                    </tr>
                  ) : apiKeys.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] px-4 py-5 text-center font-bold text-[#536271]"
                      >
                        No API keys found.
                      </td>
                    </tr>
                  ) : (
                    apiKeys.map((item) => (
                      <tr key={item.id}>
                        <td className="rounded-l-2xl border-y border-l border-[#C9D8E4] bg-white px-3 py-3 font-black text-[#06324A]">
                          {item.name}
                        </td>
                        <td className="border-y border-[#C9D8E4] bg-white px-3 py-3 font-bold text-[#536271]">
                          {item.key_prefix}
                        </td>
                        <td className="border-y border-[#C9D8E4] bg-white px-3 py-3">
                          <span
                            className={
                              item.status === "active"
                                ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700"
                                : "rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700"
                            }
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="border-y border-[#C9D8E4] bg-white px-3 py-3">
                          <div className="flex max-w-[240px] flex-wrap gap-1">
                            {(item.scopes ?? []).map((scope) => (
                              <span
                                key={scope}
                                className="rounded-full bg-[#EAF2F8] px-2 py-1 text-[11px] font-black text-[#06324A]"
                              >
                                {scope}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="border-y border-[#C9D8E4] bg-white px-3 py-3 font-bold text-[#536271]">
                          {formatDate(item.created_at)}
                        </td>
                        <td className="border-y border-[#C9D8E4] bg-white px-3 py-3 font-bold text-[#536271]">
                          {formatDate(item.last_used_at)}
                        </td>
                        <td className="rounded-r-2xl border-y border-r border-[#C9D8E4] bg-white px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            {item.status === "active" ? (
                              <button
                                type="button"
                                onClick={() => revokeApiKey(item.id)}
                                disabled={revokingId === item.id}
                                className="rounded-full bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {revokingId === item.id
                                  ? "Revoking..."
                                  : "Revoke"}
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => deleteApiKey(item.id)}
                              disabled={deletingId === item.id}
                              className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-black text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deletingId === item.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
            Safety reminder
          </p>
          <p className="mt-3 text-sm font-bold leading-6 text-[#536271]">
            Revoking is safer than deleting because it keeps the record for
            audit history. Give each API key only the scopes needed by that
            integration. App messages can be created without wallet deduction,
            but push, SMS, voice and WhatsApp must remain controlled by
            ComConnect billing, wallet and provider safeguards.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/app-api"
              className="rounded-full bg-[#0A5278] px-5 py-3 text-sm font-black text-white hover:bg-[#063E5E]"
            >
              Developer API
            </Link>
            <Link
              href="/webhooks"
              className="rounded-full border border-[#C9D8E4] bg-white px-5 py-3 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
            >
              Webhooks
            </Link>
            <Link
              href="/api-usage"
              className="rounded-full border border-[#C9D8E4] bg-white px-5 py-3 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
            >
              API Usage
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <VerticalAppShell
      organisationName={organisationName}
      projectName={projectName}
      organisationRole={organisationRole}
      projectRole={projectRole}
    >
      <main className="min-h-screen bg-[#EAF2F8] px-4 py-5 text-[#06324A]">
        {guardedContent}
      </main>
    </VerticalAppShell>
  );
}