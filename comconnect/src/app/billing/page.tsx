"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { VerticalAppShell } from "@/components/comconnect-ui/VerticalAppShell";

type BillingStatus = {
  user?: {
    id?: string;
    email?: string;
  };
  organisation?: {
    id: string;
    name: string;
    slug?: string;
    status?: string;
    role?: string;
  } | null;
  subscription?: {
    id: string;
    plan_name: string;
    status: string;
    trial_starts_at?: string | null;
    trial_ends_at?: string | null;
    trial_days_remaining?: number;
    starts_at?: string | null;
    ends_at?: string | null;
    is_trial_active?: boolean;
    is_subscription_active?: boolean;
  } | null;
  wallet?: {
    id: string;
    status: string;
    currency: string;
    balance: number;
    sms_enabled: boolean;
    voice_enabled: boolean;
    whatsapp_enabled: boolean;
  } | null;
  access?: {
    platform_allowed: boolean;
    participant_app_allowed: boolean;
    app_messaging_allowed: boolean;
    sms_allowed: boolean;
    voice_allowed: boolean;
    whatsapp_allowed: boolean;
    paid_channels_require_wallet?: boolean;
    reason?: string;
  };
  payments?: any[];
  project_spend_this_month?: Array<{
    project_id: string | null;
    project_name: string;
    amount: number;
    sms: number;
    voice: number;
    whatsapp: number;
  }>;
};

const paymentTypes = [
  {
    value: "subscription",
    label: "Subscription payment",
  },
  {
    value: "wallet_topup",
    label: "Wallet top-up",
  },
  {
    value: "subscription_and_wallet",
    label: "Subscription + wallet top-up",
  },
];

const plans = [
  "Starter / trial",
  "Research",
  "Care / Programme",
  "Enterprise / API",
];

function money(value: unknown, currency = "ZAR") {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return `${currency} 0.00`;
  }

  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateText(value?: string | null) {
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

  if (["active", "trial", "approved"].includes(value)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (["submitted", "pending_review", "inactive", "invited"].includes(value)) {
    return "bg-orange-50 text-orange-700 border-orange-200";
  }

  if (["rejected", "expired", "suspended", "cancelled"].includes(value)) {
    return "bg-red-50 text-red-700 border-red-200";
  }

  return "bg-[#EAF2F8] text-[#06324A] border-[#C9D8E4]";
}

function AccessCard({
  title,
  allowed,
  helper,
}: {
  title: string;
  allowed: boolean;
  helper: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-[#C9D8E4] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[#06324A]">{title}</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-[#536271]">
            {helper}
          </p>
        </div>

        <span
          className={[
            "rounded-full border px-3 py-1 text-xs font-black",
            allowed
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700",
          ].join(" ")}
        >
          {allowed ? "Allowed" : "Blocked"}
        </span>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [paymentType, setPaymentType] = useState("subscription");
  const [planName, setPlanName] = useState("Research");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("ZAR");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadBillingStatus() {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/billing/status", {
        cache: "no-store",
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load billing status.");
      }

      setStatus(json.data);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to load billing status.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBillingStatus();
  }, []);

  const organisationName = status?.organisation?.name ?? "No organisation";
  const organisationRole = status?.organisation?.role ?? "organisation_admin";
  const subscription = status?.subscription;
  const wallet = status?.wallet;
  const access = status?.access;

  const trialLabel = useMemo(() => {
    if (!subscription) return "No subscription";

    if (subscription.status === "trial") {
      const days = Number(subscription.trial_days_remaining ?? 0);
      return days > 0 ? `${days} day(s) remaining` : "Trial expired";
    }

    return subscription.status;
  }, [subscription]);

  async function handleSubmitReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setNotice("");
    setErrorMessage("");

    if (!receipt) {
      setErrorMessage("Upload a receipt file.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setErrorMessage("Enter a valid amount.");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();

      formData.set("payment_type", paymentType);
      formData.set("plan_name", planName);
      formData.set("amount", amount);
      formData.set("currency", currency);
      formData.set("payment_reference", paymentReference);
      formData.set("payment_date", paymentDate);
      formData.set("notes", notes);
      formData.set("receipt", receipt);

      const response = await fetch("/api/billing/payments", {
        method: "POST",
        body: formData,
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to submit receipt.");
      }

      setNotice(
        json?.data?.message ??
          "Receipt submitted. A superadmin will review it."
      );

      setAmount("");
      setPaymentReference("");
      setPaymentDate("");
      setNotes("");
      setReceipt(null);

      const fileInput = document.getElementById(
        "receipt"
      ) as HTMLInputElement | null;

      if (fileInput) fileInput.value = "";

      await loadBillingStatus();
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to submit receipt.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <VerticalAppShell
      organisationName={organisationName}
      projectName="Billing and wallet"
      organisationRole={organisationRole}
      projectRole="billing"
    >
      <main className="min-h-screen bg-[#EAF2F8] px-4 py-5 text-[#06324A]">
        <div className="mb-5 rounded-[2rem] bg-[#032A3D] p-6 text-white shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#28A9E0]">
                Billing and wallet
              </p>

              <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
                Manage subscription, trial access and paid-channel wallet.
              </h1>

              <p className="mt-3 max-w-4xl text-sm font-medium leading-7 text-white/75">
                Subscription gives access to ComConnect and the Participant app.
                SMS, voice calls and WhatsApp require a separate funded
                pay-as-you-use wallet.
              </p>
            </div>

            <Link
              href="/dashboard"
              className="rounded-full border border-white/20 px-5 py-3 text-center text-sm font-black text-white hover:bg-white/10"
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="rounded-[2rem] bg-white p-8 text-center text-sm font-black text-[#536271] shadow-sm">
            Loading billing status...
          </div>
        ) : (
          <>
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

            {!status?.organisation ? (
              <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#0A5278]">
                  No organisation
                </p>
                <h2 className="mt-3 text-2xl font-black text-[#06324A]">
                  This account is not linked to an active organisation.
                </h2>
                <p className="mt-3 text-sm font-semibold leading-7 text-[#536271]">
                  Billing can only be shown after your account is linked to an
                  organisation.
                </p>
              </div>
            ) : (
              <>
                <section className="mb-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-5 shadow-sm">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-[#0A5278]">
                      Subscription
                    </p>

                    <h2 className="mt-3 text-2xl font-black text-[#06324A]">
                      {subscription?.plan_name ?? "No plan"}
                    </h2>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className={[
                          "rounded-full border px-3 py-1 text-xs font-black",
                          statusPill(subscription?.status),
                        ].join(" ")}
                      >
                        {subscription?.status ?? "none"}
                      </span>
                      <span className="rounded-full border border-[#C9D8E4] bg-[#EAF2F8] px-3 py-1 text-xs font-black text-[#06324A]">
                        {trialLabel}
                      </span>
                    </div>

                    <p className="mt-4 text-sm font-semibold leading-7 text-[#536271]">
                      Trial: {dateText(subscription?.trial_starts_at)} to{" "}
                      {dateText(subscription?.trial_ends_at)}
                    </p>
                  </div>

                  <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-5 shadow-sm">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-[#0A5278]">
                      Wallet
                    </p>

                    <h2 className="mt-3 text-3xl font-black text-[#06324A]">
                      {money(wallet?.balance, wallet?.currency ?? "ZAR")}
                    </h2>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className={[
                          "rounded-full border px-3 py-1 text-xs font-black",
                          statusPill(wallet?.status),
                        ].join(" ")}
                      >
                        {wallet?.status ?? "none"}
                      </span>
                      <span className="rounded-full border border-[#C9D8E4] bg-[#EAF2F8] px-3 py-1 text-xs font-black text-[#06324A]">
                        {wallet?.currency ?? "ZAR"}
                      </span>
                    </div>

                    <p className="mt-4 text-sm font-semibold leading-7 text-[#536271]">
                      Paid channels require an active wallet and available
                      balance.
                    </p>
                  </div>

                  <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-5 shadow-sm">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-[#0A5278]">
                      Access rule
                    </p>

                    <h2 className="mt-3 text-2xl font-black text-[#06324A]">
                      Subscription + wallet
                    </h2>

                    <p className="mt-4 text-sm font-semibold leading-7 text-[#536271]">
                      {access?.reason ??
                        "Platform access and paid-channel wallet status will appear here."}
                    </p>
                  </div>
                </section>

                <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <AccessCard
                    title="ComConnect"
                    allowed={Boolean(access?.platform_allowed)}
                    helper="Dashboard and platform access."
                  />
                  <AccessCard
                    title="Participant app"
                    allowed={Boolean(access?.participant_app_allowed)}
                    helper="App-based trial or subscription access."
                  />
                  <AccessCard
                    title="SMS"
                    allowed={Boolean(access?.sms_allowed)}
                    helper="Requires active subscription and funded wallet."
                  />
                  <AccessCard
                    title="Voice"
                    allowed={Boolean(access?.voice_allowed)}
                    helper="Requires active subscription and funded wallet."
                  />
                  <AccessCard
                    title="WhatsApp"
                    allowed={Boolean(access?.whatsapp_allowed)}
                    helper="Requires active subscription and funded wallet."
                  />
                </section>

                <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
                  <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-[#0A5278]">
                      Submit payment receipt
                    </p>

                    <h2 className="mt-3 text-2xl font-black text-[#06324A]">
                      Upload receipt for manual review
                    </h2>

                    <p className="mt-3 text-sm font-semibold leading-7 text-[#536271]">
                      Superadmin will review your receipt and activate your
                      subscription, wallet, or both depending on the payment
                      purpose.
                    </p>

                    <form
                      className="mt-6 space-y-4"
                      onSubmit={handleSubmitReceipt}
                    >
                      <label className="block">
                        <span className="text-sm font-black text-[#06324A]">
                          Payment purpose
                        </span>
                        <select
                          value={paymentType}
                          onChange={(event) =>
                            setPaymentType(event.target.value)
                          }
                          className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
                        >
                          {paymentTypes.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-sm font-black text-[#06324A]">
                          Plan
                        </span>
                        <select
                          value={planName}
                          onChange={(event) => setPlanName(event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
                        >
                          {plans.map((item) => (
                            <option key={item}>{item}</option>
                          ))}
                        </select>
                      </label>

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block">
                          <span className="text-sm font-black text-[#06324A]">
                            Amount paid
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            placeholder="0.00"
                            className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
                          />
                        </label>

                        <label className="block">
                          <span className="text-sm font-black text-[#06324A]">
                            Currency
                          </span>
                          <input
                            value={currency}
                            onChange={(event) =>
                              setCurrency(event.target.value.toUpperCase())
                            }
                            className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
                          />
                        </label>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block">
                          <span className="text-sm font-black text-[#06324A]">
                            Payment reference
                          </span>
                          <input
                            value={paymentReference}
                            onChange={(event) =>
                              setPaymentReference(event.target.value)
                            }
                            placeholder="Bank reference / receipt number"
                            className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
                          />
                        </label>

                        <label className="block">
                          <span className="text-sm font-black text-[#06324A]">
                            Payment date
                          </span>
                          <input
                            type="date"
                            value={paymentDate}
                            onChange={(event) =>
                              setPaymentDate(event.target.value)
                            }
                            className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
                          />
                        </label>
                      </div>

                      <label className="block">
                        <span className="text-sm font-black text-[#06324A]">
                          Receipt file
                        </span>
                        <input
                          id="receipt"
                          type="file"
                          accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                          onChange={(event) =>
                            setReceipt(event.target.files?.[0] ?? null)
                          }
                          className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
                        />
                      </label>

                      <label className="block">
                        <span className="text-sm font-black text-[#06324A]">
                          Notes
                        </span>
                        <textarea
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          placeholder="Add any note for the superadmin"
                          className="mt-2 min-h-24 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
                        />
                      </label>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full rounded-full bg-[#0A5278] px-6 py-4 text-sm font-black text-white hover:bg-[#063E5E] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {submitting ? "Submitting..." : "Submit receipt"}
                      </button>
                    </form>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
                      <p className="text-sm font-black uppercase tracking-[0.2em] text-[#0A5278]">
                        Project spending
                      </p>

                      <h2 className="mt-3 text-2xl font-black text-[#06324A]">
                        This month
                      </h2>

                      <div className="mt-5 space-y-3">
                        {(status?.project_spend_this_month ?? []).length ===
                        0 ? (
                          <p className="rounded-2xl bg-[#EAF2F8] p-4 text-sm font-bold text-[#536271]">
                            No paid-channel spending recorded this month.
                          </p>
                        ) : (
                          status?.project_spend_this_month?.map((item) => (
                            <div
                              key={item.project_id ?? item.project_name}
                              className="rounded-2xl bg-[#EAF2F8] p-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-black text-[#06324A]">
                                  {item.project_name}
                                </p>
                                <p className="text-sm font-black text-[#06324A]">
                                  {money(item.amount, wallet?.currency ?? "ZAR")}
                                </p>
                              </div>
                              <p className="mt-2 text-xs font-semibold text-[#536271]">
                                SMS {money(item.sms, wallet?.currency ?? "ZAR")}{" "}
                                · Voice{" "}
                                {money(item.voice, wallet?.currency ?? "ZAR")} ·
                                WhatsApp{" "}
                                {money(
                                  item.whatsapp,
                                  wallet?.currency ?? "ZAR"
                                )}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
                      <p className="text-sm font-black uppercase tracking-[0.2em] text-[#0A5278]">
                        Recent receipts
                      </p>

                      <div className="mt-5 space-y-3">
                        {(status?.payments ?? []).length === 0 ? (
                          <p className="rounded-2xl bg-[#EAF2F8] p-4 text-sm font-bold text-[#536271]">
                            No receipts submitted yet.
                          </p>
                        ) : (
                          status?.payments?.map((payment) => (
                            <div
                              key={payment.id}
                              className="rounded-2xl bg-[#EAF2F8] p-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-black text-[#06324A]">
                                  {payment.payment_type}
                                </p>
                                <span
                                  className={[
                                    "rounded-full border px-3 py-1 text-xs font-black",
                                    statusPill(payment.status),
                                  ].join(" ")}
                                >
                                  {payment.status}
                                </span>
                              </div>

                              <p className="mt-2 text-xs font-semibold leading-5 text-[#536271]">
                                {money(payment.amount, payment.currency)} ·{" "}
                                {dateText(payment.created_at)}
                              </p>

                              {payment.review_notes ? (
                                <p className="mt-2 text-xs font-semibold leading-5 text-[#536271]">
                                  {payment.review_notes}
                                </p>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </main>
    </VerticalAppShell>
  );
}