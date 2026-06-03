"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type PreferredChannel = "app" | "sms" | "whatsapp" | "voice";
type ParticipantStatus =
  | "active"
  | "inactive"
  | "withdrawn"
  | "completed"
  | "archived";

export default function ParticipantEditPage() {
  const params = useParams<{ participantId: string }>();
  const router = useRouter();

  const participantId = params.participantId;

  const [participantCode, setParticipantCode] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState("en");
  const [preferredChannel, setPreferredChannel] =
    useState<PreferredChannel>("app");
  const [fallbackAllowed, setFallbackAllowed] = useState(true);
  const [appAccessEnabled, setAppAccessEnabled] = useState(true);
  const [quietTimeEnabled, setQuietTimeEnabled] = useState(true);
  const [quietTimeStart, setQuietTimeStart] = useState("20:00");
  const [quietTimeEnd, setQuietTimeEnd] = useState("07:00");
  const [status, setStatus] = useState<ParticipantStatus>("active");

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadParticipant() {
      setLoading(true);
      setMessage("");

      try {
        const response = await fetch(`/api/participants/${participantId}`, {
          cache: "no-store",
        });

        const json = await response.json();

        if (!response.ok || !json?.ok) {
          throw new Error(json?.error ?? "Failed to load participant.");
        }

        const row = json.data;
        const metadata = row.metadata ?? {};

        setParticipantCode(row.participant_code ?? "");
        setProjectCode(row.projects?.project_code ?? "");
        setDisplayName(
          metadata.display_name ??
            `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim()
        );
        setFirstName(row.first_name ?? "");
        setLastName(row.last_name ?? "");
        setPhoneNumber(row.phone_number ?? "");
        setWhatsappNumber(metadata.whatsapp_number ?? "");
        setEmail(metadata.email ?? "");
        setLanguage(row.preferred_language ?? "en");
        setPreferredChannel(metadata.preferred_channel ?? "app");
        setFallbackAllowed(metadata.fallback_allowed ?? true);
        setAppAccessEnabled(row.app_access_enabled ?? true);
        setQuietTimeEnabled(metadata.quiet_time_enabled ?? true);
        setQuietTimeStart(metadata.quiet_time_start ?? "20:00");
        setQuietTimeEnd(metadata.quiet_time_end ?? "07:00");
        setStatus(row.status ?? "active");
      } catch (error: any) {
        setMessage(error?.message ?? "Failed to load participant.");
      } finally {
        setLoading(false);
      }
    }

    if (participantId) loadParticipant();
  }, [participantId]);

  async function saveParticipant() {
    setMessage("");
    setBusy(true);

    try {
      const response = await fetch(`/api/participants/${participantId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          phone_number: phoneNumber.trim() || null,
          whatsapp_number: whatsappNumber.trim() || null,
          email: email.trim() || null,
          preferred_language: language,
          preferred_channel: preferredChannel,
          fallback_allowed: fallbackAllowed,
          app_access_enabled: appAccessEnabled,
          quiet_time_enabled: quietTimeEnabled,
          quiet_time_start: quietTimeStart,
          quiet_time_end: quietTimeEnd,
          timezone: "Africa/Johannesburg",
          status,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to update participant.");
      }

      setMessage("Participant updated successfully.");

      window.setTimeout(() => {
        router.push("/participants");
      }, 700);
    } catch (error: any) {
      setMessage(error?.message ?? "Failed to update participant.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#EEF3FB] p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-[28px] border-2 border-slate-950 bg-white p-5 shadow-[4px_4px_0_#171717]">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-[#F26A21]">
                Participant registry
              </p>
              <h1 className="text-2xl font-black text-slate-950">
                Edit participant
              </h1>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Update participant details without deleting or breaking app access.
              </p>
            </div>

            <Link
              href="/participants"
              className="rounded-2xl border-2 border-slate-950 bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-[3px_3px_0_#171717]"
            >
              Back to Participants
            </Link>
          </div>

          {loading ? (
            <p className="text-sm font-bold text-slate-600">Loading...</p>
          ) : (
            <>
              <div className="mb-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border-2 border-slate-200 bg-[#FFF7F2] px-4 py-3">
                  <p className="text-xs font-black uppercase text-slate-500">
                    Participant code
                  </p>
                  <p className="text-sm font-black text-slate-950">
                    {participantCode || "—"}
                  </p>
                </div>

                <div className="rounded-2xl border-2 border-slate-200 bg-[#FFF7F2] px-4 py-3">
                  <p className="text-xs font-black uppercase text-slate-500">
                    Project code
                  </p>
                  <p className="text-sm font-black text-slate-950">
                    {projectCode || "—"}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Display name"
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
                />

                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="First name"
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
                />

                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="Last name"
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
                />

                <input
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="Phone number"
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
                />

                <input
                  value={whatsappNumber}
                  onChange={(event) => setWhatsappNumber(event.target.value)}
                  placeholder="WhatsApp number"
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
                />

                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email"
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
                />

                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
                >
                  <option value="en">English</option>
                  <option value="zu">isiZulu</option>
                </select>

                <select
                  value={preferredChannel}
                  onChange={(event) =>
                    setPreferredChannel(event.target.value as PreferredChannel)
                  }
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
                >
                  <option value="app">App first</option>
                  <option value="sms">SMS first</option>
                  <option value="whatsapp">WhatsApp first</option>
                  <option value="voice">Voice first</option>
                </select>

                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as ParticipantStatus)
                  }
                  className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21]"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="withdrawn">Withdrawn</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>

                <label className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black">
                  <input
                    type="checkbox"
                    checked={appAccessEnabled}
                    onChange={(event) =>
                      setAppAccessEnabled(event.target.checked)
                    }
                  />
                  App access
                </label>

                <label className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black">
                  <input
                    type="checkbox"
                    checked={fallbackAllowed}
                    onChange={(event) =>
                      setFallbackAllowed(event.target.checked)
                    }
                  />
                  Allow fallback
                </label>

                <label className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black">
                  <input
                    type="checkbox"
                    checked={quietTimeEnabled}
                    onChange={(event) =>
                      setQuietTimeEnabled(event.target.checked)
                    }
                  />
                  Quiet time
                </label>

                <div className="flex flex-col gap-1">
                  <label className="px-1 text-xs font-black uppercase text-slate-500">
                    Quiet start
                  </label>
                  <input
                    type="time"
                    value={quietTimeStart}
                    onChange={(event) => setQuietTimeStart(event.target.value)}
                    disabled={!quietTimeEnabled}
                    className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21] disabled:opacity-50"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="px-1 text-xs font-black uppercase text-slate-500">
                    Quiet end
                  </label>
                  <input
                    type="time"
                    value={quietTimeEnd}
                    onChange={(event) => setQuietTimeEnd(event.target.value)}
                    disabled={!quietTimeEnabled}
                    className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#F26A21] disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={saveParticipant}
                  disabled={busy}
                  className="rounded-2xl border-2 border-slate-950 bg-[#F26A21] px-4 py-3 text-sm font-black text-slate-950 shadow-[3px_3px_0_#171717] disabled:opacity-60"
                >
                  {busy ? "Saving..." : "Save changes"}
                </button>

                <Link
                  href="/participants"
                  className="rounded-2xl border-2 border-slate-950 bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-[3px_3px_0_#171717]"
                >
                  Cancel
                </Link>
              </div>
            </>
          )}

          {message ? (
            <p className="mt-3 text-sm font-black text-slate-700">
              {message}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}