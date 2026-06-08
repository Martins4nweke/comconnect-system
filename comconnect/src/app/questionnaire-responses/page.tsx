"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  CompactCard,
  FieldLabel,
  Notice,
  PageShell,
  SelectInput,
  StatusPill,
  TextInput,
} from "@/components/comconnect-ui/DashboardUI";

type CurrentContext = {
  organisation_id?: string | null;
  organisation_name?: string | null;
  organisation_role?: string | null;
  active_project_id?: string | null;
  active_project_name?: string | null;
  active_project_code?: string | null;
  project_role?: string | null;
};

type QuestionnaireResponse = {
  id: string;
  organisation_id: string;
  project_id: string;
  participant_id: string;
  questionnaire_id: string;
  local_id?: string | null;
  answers?: any;
  status?: string | null;
  score?: any;
  created_offline_at?: string | null;
  submitted_at?: string | null;
  synced_at?: string | null;
  metadata?: any;
  created_at?: string | null;
  participant_label?: string | null;
  participant?: {
    id?: string;
    participant_code?: string | null;
    phone_number?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
    preferred_language?: string | null;
    status?: string | null;
  } | null;
  questionnaire?: {
    id?: string;
    title?: string | null;
    description?: string | null;
    language?: string | null;
    status?: string | null;
    version_label?: string | null;
    settings?: any;
  } | null;
};

type PaginationState = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_previous: boolean;
  has_next: boolean;
  from: number;
  to: number;
};

const pageLinkClass =
  "rounded-2xl border border-[#C9D8E4] bg-white px-4 py-2 text-sm font-black text-[#06324A] shadow-sm hover:border-[#0A5278] hover:text-[#0A5278]";

const secondaryButtonClass =
  "rounded-xl border border-[#C9D8E4] bg-white px-4 py-2 text-xs font-black text-[#06324A] hover:border-[#0A5278] hover:text-[#0A5278] disabled:cursor-not-allowed disabled:opacity-50";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function dt(value?: string | null) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function participantLabel(row: QuestionnaireResponse) {
  const participant = row.participant;

  if (!participant) return row.participant_label ?? "—";

  const fullName = `${participant.first_name ?? ""} ${
    participant.last_name ?? ""
  }`.trim();

  return (
    participant.display_name ||
    fullName ||
    participant.participant_code ||
    participant.phone_number ||
    row.participant_label ||
    "—"
  );
}

function statusTone(
  status?: string | null
): "success" | "warning" | "danger" | "info" | "neutral" {
  const text = cleanText(status).toLowerCase();

  if (["submitted", "synced", "completed", "received"].includes(text)) {
    return "success";
  }

  if (["draft", "partial", "pending"].includes(text)) {
    return "warning";
  }

  if (["failed", "error", "rejected"].includes(text)) {
    return "danger";
  }

  return "neutral";
}

function answerCount(answers: any) {
  if (!answers) return 0;

  if (Array.isArray(answers)) return answers.length;

  if (typeof answers === "object") {
    return Object.keys(answers).length;
  }

  return 1;
}

function answerPreview(answers: any) {
  if (!answers) return "No answers";

  if (typeof answers === "string") {
    return answers;
  }

  if (Array.isArray(answers)) {
    return `${answers.length} answer item(s)`;
  }

  if (typeof answers === "object") {
    const entries = Object.entries(answers).slice(0, 3);

    if (entries.length === 0) return "No answers";

    return entries
      .map(([key, value]) => {
        const cleanValue =
          typeof value === "object" ? JSON.stringify(value) : String(value);

        return `${key}: ${cleanValue}`;
      })
      .join(" · ");
  }

  return String(answers);
}

export default function QuestionnaireResponsesPage() {
  const [context, setContext] = useState<CurrentContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  const [responses, setResponses] = useState<QuestionnaireResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState("50");

  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 50,
    total: 0,
    total_pages: 1,
    has_previous: false,
    has_next: false,
    from: 0,
    to: 0,
  });

  const [errorMessage, setErrorMessage] = useState("");

  const activeProjectId = cleanText(context?.active_project_id);

  const currentResponse = useMemo(() => {
    return responses.find((row) => row.id === expandedId) ?? null;
  }, [responses, expandedId]);

  async function loadContext() {
    setLoadingContext(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/context/current", {
        cache: "no-store",
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load context.");
      }

      setContext(json.data as CurrentContext);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to load context.");
    } finally {
      setLoadingContext(false);
    }
  }

  async function loadResponses(nextPage = page) {
    setErrorMessage("");

    if (!activeProjectId) {
      setErrorMessage("No active project selected.");
      return;
    }

    setLoadingResponses(true);

    try {
      const params = new URLSearchParams();
      params.set("project_id", activeProjectId);
      params.set("page", String(nextPage));
      params.set("limit", limit || "50");

      if (statusFilter) {
        params.set("status", statusFilter);
      }

      if (search) {
        params.set("q", search);
      }

      const response = await fetch(
        `/api/questionnaire-responses?${params.toString()}`,
        { cache: "no-store" }
      );

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load questionnaire responses.");
      }

      setResponses(Array.isArray(json.data) ? json.data : []);
      setPagination(json.pagination ?? pagination);
      setExpandedId(null);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to load questionnaire responses.");
    } finally {
      setLoadingResponses(false);
    }
  }

  function applySearch() {
    setSearch(pendingSearch.trim());
    setPage(1);
  }

  function clearSearch() {
    setPendingSearch("");
    setSearch("");
    setPage(1);
  }

  function nextPage() {
    if (!pagination.has_next) return;

    setPage((current) => current + 1);
  }

  function previousPage() {
    if (!pagination.has_previous) return;

    setPage((current) => Math.max(1, current - 1));
  }

  useEffect(() => {
    void loadContext();
  }, []);

  useEffect(() => {
    if (activeProjectId) {
      void loadResponses(page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId, page, limit, statusFilter, search]);

  return (
    <PageShell>
      <section className="mb-5 rounded-[2rem] border border-[#C9D8E4] bg-[#032A3D] p-6 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#C9D8E4]">
          Research
        </p>

        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              Questionnaire Responses
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#EAF2F8]">
              Review submitted questionnaire responses with server-side
              pagination for large studies.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className={pageLinkClass}>
              Dashboard
            </Link>
            <Link href="/questionnaires" className={pageLinkClass}>
              Questionnaires
            </Link>
            <Link href="/inbox" className={pageLinkClass}>
              Central Inbox
            </Link>
            <Link href="/export" className={pageLinkClass}>
              Export
            </Link>
          </div>
        </div>
      </section>

      {errorMessage ? <Notice tone="danger">{errorMessage}</Notice> : null}

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <CompactCard>
          <p className="text-xs font-black uppercase text-[#536271]">
            Organisation
          </p>
          <p className="mt-1 text-sm font-black text-[#06324A]">
            {loadingContext ? "Loading..." : context?.organisation_name ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-[#536271]">
            Project
          </p>
          <p className="mt-1 text-sm font-black text-[#06324A]">
            {loadingContext ? "Loading..." : context?.active_project_name ?? "—"}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-[#536271]">
            Total responses
          </p>
          <p className="mt-1 text-sm font-black text-[#06324A]">
            {pagination.total}
          </p>
        </CompactCard>

        <CompactCard>
          <p className="text-xs font-black uppercase text-[#536271]">
            Current page
          </p>
          <p className="mt-1 text-sm font-black text-[#06324A]">
            {pagination.page} of {pagination.total_pages}
          </p>
        </CompactCard>
      </div>

      <CompactCard
        title="Responses"
        subtitle="Submitted questionnaire response records."
        action={
          <button
            type="button"
            onClick={() => loadResponses(page)}
            disabled={loadingResponses || !activeProjectId}
            className={secondaryButtonClass}
          >
            {loadingResponses ? "Refreshing..." : "Refresh"}
          </button>
        }
      >
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px_140px]">
          <FieldLabel label="Search">
            <div className="flex gap-2">
              <TextInput
                value={pendingSearch}
                onChange={(event) => setPendingSearch(event.target.value)}
                placeholder="Participant, phone, questionnaire or local ID"
              />

              <button
                type="button"
                onClick={applySearch}
                className={secondaryButtonClass}
              >
                Search
              </button>

              <button
                type="button"
                onClick={clearSearch}
                className={secondaryButtonClass}
              >
                Clear
              </button>
            </div>
          </FieldLabel>

          <FieldLabel label="Status">
            <SelectInput
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="submitted">Submitted</option>
              <option value="synced">Synced</option>
              <option value="completed">Completed</option>
              <option value="partial">Partial</option>
              <option value="draft">Draft</option>
              <option value="failed">Failed</option>
            </SelectInput>
          </FieldLabel>

          <FieldLabel label="Per page">
            <SelectInput
              value={limit}
              onChange={(event) => {
                setLimit(event.target.value);
                setPage(1);
              }}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </SelectInput>
          </FieldLabel>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] p-3">
          <p className="text-xs font-bold text-[#536271]">
            Showing {pagination.total === 0 ? 0 : pagination.from + 1}–
            {Math.min(pagination.to + 1, pagination.total)} of{" "}
            {pagination.total} response(s)
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={previousPage}
              disabled={!pagination.has_previous || loadingResponses}
              className={secondaryButtonClass}
            >
              Previous
            </button>

            <button
              type="button"
              onClick={nextPage}
              disabled={!pagination.has_next || loadingResponses}
              className={secondaryButtonClass}
            >
              Next
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#C9D8E4] bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#C9D8E4] text-sm">
              <thead className="bg-[#EAF2F8]">
                <tr>
                  <th className="px-4 py-3 text-left font-black text-[#06324A]">
                    Submitted
                  </th>
                  <th className="px-4 py-3 text-left font-black text-[#06324A]">
                    Participant
                  </th>
                  <th className="px-4 py-3 text-left font-black text-[#06324A]">
                    Questionnaire
                  </th>
                  <th className="px-4 py-3 text-left font-black text-[#06324A]">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-black text-[#06324A]">
                    Answers
                  </th>
                  <th className="px-4 py-3 text-left font-black text-[#06324A]">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#EAF2F8]">
                {loadingResponses ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-sm font-bold text-[#536271]"
                    >
                      Loading responses...
                    </td>
                  </tr>
                ) : responses.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-sm font-bold text-[#536271]"
                    >
                      No questionnaire responses found.
                    </td>
                  </tr>
                ) : (
                  responses.map((row) => (
                    <Fragment key={row.id}>
                      <tr className="align-top hover:bg-[#EAF2F8]">
                        <td className="px-4 py-3 font-bold text-[#06324A]">
                          <p>{dt(row.submitted_at)}</p>
                          <p className="text-xs text-[#536271]">
                            Synced: {dt(row.synced_at)}
                          </p>
                        </td>

                        <td className="px-4 py-3 font-bold text-[#06324A]">
                          <p>{participantLabel(row)}</p>
                          <p className="text-xs text-[#536271]">
                            {row.participant?.participant_code ?? "—"} ·{" "}
                            {row.participant?.phone_number ?? "—"}
                          </p>
                        </td>

                        <td className="px-4 py-3 font-bold text-[#06324A]">
                          <p>{row.questionnaire?.title ?? "—"}</p>
                          <p className="text-xs text-[#536271]">
                            {row.questionnaire?.language ?? "—"} ·{" "}
                            {row.questionnaire?.version_label ?? "—"}
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          <StatusPill tone={statusTone(row.status)}>
                            {row.status ?? "—"}
                          </StatusPill>
                        </td>

                        <td className="px-4 py-3 text-[#06324A]">
                          <p className="max-w-lg truncate text-xs font-semibold">
                            {answerPreview(row.answers)}
                          </p>
                          <p className="mt-1 text-xs font-bold text-[#536271]">
                            {answerCount(row.answers)} answer field(s)
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId((current) =>
                                current === row.id ? null : row.id
                              )
                            }
                            className={secondaryButtonClass}
                          >
                            {expandedId === row.id ? "Hide" : "View"}
                          </button>
                        </td>
                      </tr>

                      {expandedId === row.id ? (
                        <tr key={`${row.id}-details`}>
                          <td colSpan={6} className="bg-[#EAF2F8] px-4 py-4">
                            <div className="rounded-2xl border border-[#C9D8E4] bg-white p-4">
                              <div className="mb-3 flex flex-col justify-between gap-2 md:flex-row md:items-center">
                                <div>
                                  <p className="text-sm font-black text-[#06324A]">
                                    Response details
                                  </p>
                                  <p className="text-xs font-bold text-[#536271]">
                                    {participantLabel(row)} ·{" "}
                                    {row.questionnaire?.title ?? "—"}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setExpandedId(null)}
                                  className={secondaryButtonClass}
                                >
                                  Close
                                </button>
                              </div>

                              <div className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-xl border border-[#C9D8E4] bg-[#EAF2F8] p-3">
                                  <p className="text-xs font-black uppercase text-[#536271]">
                                    Submitted
                                  </p>
                                  <p className="mt-1 text-sm font-bold text-[#06324A]">
                                    {dt(row.submitted_at)}
                                  </p>
                                </div>

                                <div className="rounded-xl border border-[#C9D8E4] bg-[#EAF2F8] p-3">
                                  <p className="text-xs font-black uppercase text-[#536271]">
                                    Synced
                                  </p>
                                  <p className="mt-1 text-sm font-bold text-[#06324A]">
                                    {dt(row.synced_at)}
                                  </p>
                                </div>

                                <div className="rounded-xl border border-[#C9D8E4] bg-[#EAF2F8] p-3">
                                  <p className="text-xs font-black uppercase text-[#536271]">
                                    Status
                                  </p>
                                  <p className="mt-1 text-sm font-bold text-[#06324A]">
                                    {row.status ?? "—"}
                                  </p>
                                </div>
                              </div>

                              <p className="mt-4 text-xs font-black uppercase text-[#536271]">
                                Answers
                              </p>

                              <pre className="mt-2 max-h-80 overflow-auto rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] p-4 text-xs font-semibold leading-5 text-[#06324A]">
                                {JSON.stringify(row.answers ?? {}, null, 2)}
                              </pre>

                              <p className="mt-4 text-xs font-black uppercase text-[#536271]">
                                Full response record
                              </p>

                              <pre className="mt-2 max-h-80 overflow-auto rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] p-4 text-xs font-semibold leading-5 text-[#06324A]">
                                {JSON.stringify(row, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {currentResponse ? (
          <p className="mt-3 text-xs font-bold text-[#536271]">
            Viewing response ID: {currentResponse.id}
          </p>
        ) : null}
      </CompactCard>
    </PageShell>
  );
}