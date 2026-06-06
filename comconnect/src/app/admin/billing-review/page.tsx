"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { VerticalAppShell } from "@/components/comconnect-ui/VerticalAppShell";

type OrganisationBilling = {
  id: string;
  name: string;
  slug?: string | null;
  status: string;
  created_at?: string;
  plan_name: string;
  subscription_status: string;
  trial_starts_at?: string | null;
  trial_ends_at?: string | null;
  trial_days_remaining: number;
  starts_at?: string | null;
  ends_at?: string | null;
  wallet_status: string;
  wallet_currency: string;
  wallet_balance: number;
  sms_enabled: boolean;
  voice_enabled: boolean;
  whatsapp_enabled: boolean;
  pending_payments: number;
};

type BillingPayment = {
  id: string;
  organisation_id: string;
  uploaded_by?: string | null;
  payment_type: string;
  plan_name?: string | null;
  amount: number;
  currency: string;
  receipt_url?: string | null;
  receipt_name?: string | null;
  payment_reference?: string | null;
  payment_date?: string | null;
  status: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_at: string;
  organisations?: {
    name?: string | null;
    slug?: string | null;
  } | null;
};

function money(value: unknown, currency = "ZAR") {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) return `${currency} 0.00`;

  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateText(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function shortDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusPill(status?: string | null) {
  const value = String(status ?? "unknown").toLowerCase();

  if (["approved", "active", "trial"].includes(value)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (["submitted", "pending_review", "inactive", "none"].includes(value)) {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (["rejected", "expired", "suspended", "cancelled"].includes(value)) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-[#C9D8E4] bg-[#EAF2F8] text-[#06324A]";
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

export default function AdminBillingReviewPage() {
  const [organisations, setOrganisations] = useState<OrganisationBilling[]>([]);
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [enableSms, setEnableSms] = useState<Record<string, boolean>>({});
  const [enableVoice, setEnableVoice] = useState<Record<string, boolean>>({});
  const [enableWhatsapp, setEnableWhatsapp] = useState<Record<string, boolean>>(
    {}
  );

  async function loadPayments() {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/admin/billing/payments", {
        cache: "no-store",
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load billing payments.");
      }

      setOrganisations(json.data?.organisations ?? []);
      setPayments(json.data?.payments ?? []);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to load billing payments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayments();
  }, []);

  async function reviewPayment(
    event: FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>,
    payment: BillingPayment,
    action: "approve" | "reject"
  ) {
    event.preventDefault();

    setNotice("");
    setErrorMessage("");
    setReviewingId(payment.id);

    try {
      const response = await fetch("/api/admin/billing/payments", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment_id: payment.id,
          action,
          review_notes: reviewNotes[payment.id] ?? "",
          enable_sms: Boolean(enableSms[payment.id]),
          enable_voice: Boolean(enableVoice[payment.id]),
          enable_whatsapp: Boolean(enableWhatsapp[payment.id]),
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to review payment.");
      }

      setNotice(json?.data?.message ?? "Payment reviewed.");

      await loadPayments();
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to review payment.");
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <VerticalAppShell
      organisationName="ComConnect Admin"
      projectName="Billing review"
      organisationRole="platform_owner"
      projectRole="admin"
    >
      <main className="min-h-screen bg-[#EAF2F8] px-4 py-5 text-[#06324A]">
        <div className="mb-5 rounded-[2rem] bg-[#032A3D] p-6 text-white shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#28A9E0]">
                Superadmin billing
              </p>

              <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
                Review receipts and monitor organisation plans.
              </h1>

              <p className="mt-3 max-w-4xl text-sm font-medium leading-7 text-white/75">
                View all organisations, their current plans, trial status,
                wallet balance and paid-channel access. Approve receipts to
                activate subscriptions or wallet top-ups.
              </p>
            </div>

            <Link
              href="/billing"
              className="rounded-full border border-white/20 px-5 py-3 text-center text-sm font-black text-white hover:bg-white/10"
            >
              Open billing page
            </Link>
          </div>
        </div>

        {errorMessage ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {notice ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
            {notice}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[2rem] bg-white p-8 text-center text-sm font-black text-[#536271] shadow-sm">
            Loading billing records...
          </div>
        ) : (
          <>
            <section className="mb-6 rounded-[2rem] border border-[#C9D8E4] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-[#0A5278]">
                    Organisation billing overview
                  </p>

                  <h2 className="mt-3 text-2xl font-black text-[#06324A]">
                    All organisations and current billing status
                  </h2>

                  <p className="mt-2 text-sm font-semibold leading-7 text-[#536271]">
                    Subscription controls ComConnect and Participant app access.
                    Wallet controls SMS, voice and WhatsApp.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadPayments}
                  className="rounded-full border border-[#C9D8E4] px-5 py-3 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="min-w-[1100px] w-full border-separate border-spacing-y-2 text-left text-sm">
                  <thead>
                    <tr className="text-xs font-black uppercase tracking-[0.12em] text-[#536271]">
                      <th className="px-3 py-2">Organisation</th>
                      <th className="px-3 py-2">Plan</th>
                      <th className="px-3 py-2">Subscription</th>
                      <th className="px-3 py-2">Trial ends</th>
                      <th className="px-3 py-2">Wallet</th>
                      <th className="px-3 py-2">Balance</th>
                      <th className="px-3 py-2">SMS</th>
                      <th className="px-3 py-2">Voice</th>
                      <th className="px-3 py-2">WhatsApp</th>
                      <th className="px-3 py-2">Pending</th>
                    </tr>
                  </thead>

                  <tbody>
                    {organisations.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="rounded-2xl bg-[#EAF2F8] px-4 py-5 text-center text-sm font-bold text-[#536271]"
                        >
                          No organisations found.
                        </td>
                      </tr>
                    ) : (
                      organisations.map((org) => (
                        <tr key={org.id} className="bg-[#EAF2F8]">
                          <td className="rounded-l-2xl px-3 py-3">
                            <p className="font-black text-[#06324A]">
                              {org.name}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-[#536271]">
                              {org.slug ?? org.id}
                            </p>
                          </td>

                          <td className="px-3 py-3 font-bold text-[#06324A]">
                            {org.plan_name}
                          </td>

                          <td className="px-3 py-3">
                            <span
                              className={[
                                "rounded-full border px-3 py-1 text-xs font-black",
                                statusPill(org.subscription_status),
                              ].join(" ")}
                            >
                              {org.subscription_status}
                            </span>
                          </td>

                          <td className="px-3 py-3">
                            <p className="font-bold text-[#06324A]">
                              {shortDate(org.trial_ends_at)}
                            </p>
                            <p className="text-xs font-semibold text-[#536271]">
                              {org.trial_days_remaining > 0
                                ? `${org.trial_days_remaining} day(s)`
                                : "No trial left"}
                            </p>
                          </td>

                          <td className="px-3 py-3">
                            <span
                              className={[
                                "rounded-full border px-3 py-1 text-xs font-black",
                                statusPill(org.wallet_status),
                              ].join(" ")}
                            >
                              {org.wallet_status}
                            </span>
                          </td>

                          <td className="px-3 py-3 font-black text-[#06324A]">
                            {money(org.wallet_balance, org.wallet_currency)}
                          </td>

                          <td className="px-3 py-3 font-bold text-[#06324A]">
                            {yesNo(org.sms_enabled)}
                          </td>

                          <td className="px-3 py-3 font-bold text-[#06324A]">
                            {yesNo(org.voice_enabled)}
                          </td>

                          <td className="px-3 py-3 font-bold text-[#06324A]">
                            {yesNo(org.whatsapp_enabled)}
                          </td>

                          <td className="rounded-r-2xl px-3 py-3">
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#06324A]">
                              {org.pending_payments}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mb-4">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#0A5278]">
                Receipt review
              </p>

              <h2 className="mt-2 text-2xl font-black text-[#06324A]">
                Submitted and reviewed payment receipts
              </h2>
            </section>

            {payments.length === 0 ? (
              <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#0A5278]">
                  No receipts
                </p>
                <h2 className="mt-3 text-2xl font-black text-[#06324A]">
                  No billing receipts have been submitted yet.
                </h2>
              </div>
            ) : (
              <section className="space-y-4">
                {payments.map((payment) => {
                  const isSubmitted = payment.status === "submitted";
                  const isWalletPayment =
                    payment.payment_type === "wallet_topup" ||
                    payment.payment_type === "subscription_and_wallet";

                  return (
                    <div
                      key={payment.id}
                      className="rounded-[2rem] border border-[#C9D8E4] bg-white p-5 shadow-sm"
                    >
                      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                        <div>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
                                {payment.organisations?.name ??
                                  "Unknown organisation"}
                              </p>

                              <h2 className="mt-2 text-2xl font-black text-[#06324A]">
                                {payment.payment_type.replaceAll("_", " ")}
                              </h2>
                            </div>

                            <span
                              className={[
                                "rounded-full border px-3 py-1 text-xs font-black",
                                statusPill(payment.status),
                              ].join(" ")}
                            >
                              {payment.status}
                            </span>
                          </div>

                          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-2xl bg-[#EAF2F8] p-4">
                              <p className="text-xs font-black uppercase text-[#536271]">
                                Amount
                              </p>
                              <p className="mt-1 text-sm font-black text-[#06324A]">
                                {money(payment.amount, payment.currency)}
                              </p>
                            </div>

                            <div className="rounded-2xl bg-[#EAF2F8] p-4">
                              <p className="text-xs font-black uppercase text-[#536271]">
                                Plan
                              </p>
                              <p className="mt-1 text-sm font-black text-[#06324A]">
                                {payment.plan_name ?? "—"}
                              </p>
                            </div>

                            <div className="rounded-2xl bg-[#EAF2F8] p-4">
                              <p className="text-xs font-black uppercase text-[#536271]">
                                Reference
                              </p>
                              <p className="mt-1 text-sm font-black text-[#06324A]">
                                {payment.payment_reference ?? "—"}
                              </p>
                            </div>

                            <div className="rounded-2xl bg-[#EAF2F8] p-4">
                              <p className="text-xs font-black uppercase text-[#536271]">
                                Submitted
                              </p>
                              <p className="mt-1 text-sm font-black text-[#06324A]">
                                {dateText(payment.created_at)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 rounded-2xl border border-[#C9D8E4] bg-white p-4">
                            <p className="text-xs font-black uppercase text-[#536271]">
                              Receipt
                            </p>
                            <p className="mt-1 text-sm font-bold text-[#06324A]">
                              {payment.receipt_name ?? "No receipt name"}
                            </p>
                            <p className="mt-1 break-all text-xs font-semibold text-[#536271]">
                              {payment.receipt_url ?? "No receipt path"}
                            </p>
                          </div>

                          {payment.review_notes ? (
                            <div className="mt-4 rounded-2xl bg-[#EAF2F8] p-4">
                              <p className="text-xs font-black uppercase text-[#536271]">
                                Review notes
                              </p>
                              <p className="mt-1 text-sm font-semibold leading-6 text-[#06324A]">
                                {payment.review_notes}
                              </p>
                            </div>
                          ) : null}
                        </div>

                        <form
                          className="rounded-[1.5rem] border border-[#C9D8E4] bg-[#EAF2F8] p-4"
                          onSubmit={(event) =>
                            reviewPayment(event, payment, "approve")
                          }
                        >
                          <p className="text-sm font-black text-[#06324A]">
                            Superadmin action
                          </p>

                          <label className="mt-4 block">
                            <span className="text-xs font-black uppercase text-[#536271]">
                              Review notes
                            </span>
                            <textarea
                              disabled={!isSubmitted}
                              value={reviewNotes[payment.id] ?? ""}
                              onChange={(event) =>
                                setReviewNotes((current) => ({
                                  ...current,
                                  [payment.id]: event.target.value,
                                }))
                              }
                              placeholder="Add approval/rejection note"
                              className="mt-2 min-h-24 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278] disabled:opacity-60"
                            />
                          </label>

                          {isWalletPayment ? (
                            <div className="mt-4 rounded-2xl bg-white p-4">
                              <p className="text-xs font-black uppercase text-[#536271]">
                                Enable paid channels
                              </p>

                              <div className="mt-3 space-y-2">
                                <label className="flex items-center gap-2 text-sm font-bold text-[#06324A]">
                                  <input
                                    type="checkbox"
                                    disabled={!isSubmitted}
                                    checked={Boolean(enableSms[payment.id])}
                                    onChange={(event) =>
                                      setEnableSms((current) => ({
                                        ...current,
                                        [payment.id]: event.target.checked,
                                      }))
                                    }
                                  />
                                  SMS
                                </label>

                                <label className="flex items-center gap-2 text-sm font-bold text-[#06324A]">
                                  <input
                                    type="checkbox"
                                    disabled={!isSubmitted}
                                    checked={Boolean(enableVoice[payment.id])}
                                    onChange={(event) =>
                                      setEnableVoice((current) => ({
                                        ...current,
                                        [payment.id]: event.target.checked,
                                      }))
                                    }
                                  />
                                  Voice calls
                                </label>

                                <label className="flex items-center gap-2 text-sm font-bold text-[#06324A]">
                                  <input
                                    type="checkbox"
                                    disabled={!isSubmitted}
                                    checked={Boolean(enableWhatsapp[payment.id])}
                                    onChange={(event) =>
                                      setEnableWhatsapp((current) => ({
                                        ...current,
                                        [payment.id]: event.target.checked,
                                      }))
                                    }
                                  />
                                  WhatsApp
                                </label>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-semibold leading-6 text-[#536271]">
                              This is a subscription-only payment. Approval will
                              activate platform and Participant app access, but
                              SMS, voice and WhatsApp will remain blocked until
                              wallet top-up is approved.
                            </div>
                          )}

                          <div className="mt-4 grid gap-2">
                            <button
                              type="submit"
                              disabled={
                                !isSubmitted || reviewingId === payment.id
                              }
                              className="rounded-full bg-[#0A5278] px-5 py-3 text-sm font-black text-white hover:bg-[#063E5E] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {reviewingId === payment.id
                                ? "Processing..."
                                : "Approve"}
                            </button>

                            <button
                              type="button"
                              disabled={
                                !isSubmitted || reviewingId === payment.id
                              }
                              onClick={(event) =>
                                reviewPayment(event, payment, "reject")
                              }
                              className="rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </section>
            )}
          </>
        )}
      </main>
    </VerticalAppShell>
  );
}