"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { VerticalAppShell } from "@/components/comconnect-ui/VerticalAppShell";

type ChannelPrice = {
  id: string | null;
  channel: "sms" | "voice" | "whatsapp";
  currency: string;
  unit_price: number;
  status: string;
  effective_from?: string | null;
  effective_to?: string | null;
  metadata?: Record<string, any>;
};

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

  return date.toLocaleString();
}

function labelForChannel(channel: string) {
  if (channel === "sms") return "SMS";
  if (channel === "voice") return "Voice calls";
  if (channel === "whatsapp") return "WhatsApp";
  return channel;
}

function statusPill(status?: string | null) {
  const value = String(status ?? "unknown").toLowerCase();

  if (value === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "archived" || value === "inactive") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  return "border-[#C9D8E4] bg-[#EAF2F8] text-[#06324A]";
}

export default function AdminBillingSettingsPage() {
  const [prices, setPrices] = useState<ChannelPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingChannel, setSavingChannel] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});
  const [draftCurrencies, setDraftCurrencies] = useState<Record<string, string>>(
    {}
  );

  async function loadPrices() {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/admin/billing/channel-prices", {
        cache: "no-store",
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to load billing settings.");
      }

      const nextPrices: ChannelPrice[] = json.data?.prices ?? [];

      setPrices(nextPrices);

      const nextDraftPrices: Record<string, string> = {};
      const nextDraftCurrencies: Record<string, string> = {};

      for (const price of nextPrices) {
        nextDraftPrices[price.channel] = String(price.unit_price ?? "");
        nextDraftCurrencies[price.channel] = price.currency ?? "ZAR";
      }

      setDraftPrices(nextDraftPrices);
      setDraftCurrencies(nextDraftCurrencies);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to load billing settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPrices();
  }, []);

  async function updatePrice(
    event: FormEvent<HTMLFormElement>,
    channel: ChannelPrice["channel"]
  ) {
    event.preventDefault();

    setNotice("");
    setErrorMessage("");
    setSavingChannel(channel);

    try {
      const unitPrice = Number(draftPrices[channel]);
      const currency = String(draftCurrencies[channel] || "ZAR")
        .trim()
        .toUpperCase();

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error("Enter a valid unit price.");
      }

      const response = await fetch("/api/admin/billing/channel-prices", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel,
          currency,
          unit_price: unitPrice,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to update price.");
      }

      setNotice(json?.data?.message ?? "Price updated.");
      await loadPrices();
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to update price.");
    } finally {
      setSavingChannel(null);
    }
  }

  return (
    <VerticalAppShell
      organisationName="ComConnect Admin"
      projectName="Billing settings"
      organisationRole="platform_owner"
      projectRole="admin"
    >
      <main className="min-h-screen bg-[#EAF2F8] px-4 py-5 text-[#06324A]">
        <div className="mb-5 rounded-[2rem] bg-[#032A3D] p-6 text-white shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#28A9E0]">
                Admin billing settings
              </p>

              <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
                Configure paid-channel prices.
              </h1>

              <p className="mt-3 max-w-4xl text-sm font-medium leading-7 text-white/75">
                These prices are used when ComConnect deducts wallet balance for
                successful SMS, voice and WhatsApp delivery. New prices apply to
                future deductions only.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/billing-review"
                className="rounded-full border border-white/20 px-5 py-3 text-center text-sm font-black text-white hover:bg-white/10"
              >
                Billing review
              </Link>

              <Link
                href="/billing"
                className="rounded-full border border-white/20 px-5 py-3 text-center text-sm font-black text-white hover:bg-white/10"
              >
                User billing
              </Link>
            </div>
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
            Loading billing settings...
          </div>
        ) : (
          <section className="grid gap-4 xl:grid-cols-3">
            {prices.map((price) => (
              <form
                key={price.channel}
                onSubmit={(event) => updatePrice(event, price.channel)}
                className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
                      {price.channel}
                    </p>

                    <h2 className="mt-2 text-2xl font-black text-[#06324A]">
                      {labelForChannel(price.channel)}
                    </h2>
                  </div>

                  <span
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-black",
                      statusPill(price.status),
                    ].join(" ")}
                  >
                    {price.status}
                  </span>
                </div>

                <div className="mt-5 rounded-2xl bg-[#EAF2F8] p-4">
                  <p className="text-xs font-black uppercase text-[#536271]">
                    Current price
                  </p>

                  <p className="mt-1 text-3xl font-black text-[#06324A]">
                    {money(price.unit_price, price.currency)}
                  </p>

                  <p className="mt-2 text-xs font-semibold leading-5 text-[#536271]">
                    Effective from: {dateText(price.effective_from)}
                  </p>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-[1fr_120px]">
                  <label className="block">
                    <span className="text-sm font-black text-[#06324A]">
                      New unit price
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draftPrices[price.channel] ?? ""}
                      onChange={(event) =>
                        setDraftPrices((current) => ({
                          ...current,
                          [price.channel]: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-black text-[#06324A]">
                      Currency
                    </span>

                    <input
                      value={draftCurrencies[price.channel] ?? "ZAR"}
                      onChange={(event) =>
                        setDraftCurrencies((current) => ({
                          ...current,
                          [price.channel]: event.target.value.toUpperCase(),
                        }))
                      }
                      className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={savingChannel === price.channel}
                  className="mt-5 w-full rounded-full bg-[#0A5278] px-6 py-4 text-sm font-black text-white hover:bg-[#063E5E] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingChannel === price.channel
                    ? "Saving..."
                    : `Update ${labelForChannel(price.channel)} price`}
                </button>
              </form>
            ))}
          </section>
        )}

        <section className="mt-5 rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#0A5278]">
            Important billing rule
          </p>

          <p className="mt-3 text-sm font-semibold leading-7 text-[#536271]">
            Subscription controls access to ComConnect and the Participant app.
            These channel prices only apply to paid channels. SMS, voice and
            WhatsApp still require an active wallet, enabled channel and
            sufficient balance before delivery can proceed.
          </p>
        </section>
      </main>
    </VerticalAppShell>
  );
}