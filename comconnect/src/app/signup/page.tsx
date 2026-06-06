"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const PARTICIPANT_APP_URL =
  "https://expo.dev/accounts/rm221/projects/comconnect-participant/builds/cc98c087-89df-47ca-a93a-33e6b5c9722e";

const useCases = [
  "Research study",
  "Public health programme",
  "Clinic or care follow-up",
  "Community intervention",
  "API integration / developer access",
  "Other structured programme",
];

const benefits = [
  {
    title: "Participant app first",
    text:
      "Trial access allows you to test text, audio, video, education, questionnaires and two-way chat through the Participant app.",
  },
  {
    title: "Controlled paid channels",
    text:
      "SMS, voice calls and WhatsApp require subscription activation, provider setup and a funded pay-as-you-use wallet.",
  },
  {
    title: "Health and research ready",
    text:
      "Create projects, participants, education material, questionnaires, schedules, alerts, exports and audit-ready records.",
  },
  {
    title: "API reviewed separately",
    text:
      "Developer API access is enabled only for approved subscription plans or add-ons, with project-scoped permissions.",
  },
];

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [organisationName, setOrganisationName] = useState("");
  const [useCase, setUseCase] = useState(useCases[0]);
  const [expectedParticipants, setExpectedParticipants] = useState("Under 500");
  const [preferredPlan, setPreferredPlan] = useState("Starter / trial");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  setErrorMessage("");
  setSuccessMessage("");

  const cleanEmail = email.trim().toLowerCase();
  const cleanFullName = fullName.trim();
  const cleanOrganisationName = organisationName.trim();

  if (!cleanFullName) {
    setErrorMessage("Enter your full name.");
    return;
  }

  if (!cleanEmail) {
    setErrorMessage("Enter your work email.");
    return;
  }

  if (!cleanOrganisationName) {
    setErrorMessage("Enter your organisation name.");
    return;
  }

  if (password.length < 8) {
    setErrorMessage("Password must be at least 8 characters.");
    return;
  }

  if (password !== confirmPassword) {
    setErrorMessage("Passwords do not match.");
    return;
  }

  setCreating(true);

  try {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: cleanFullName,
        email: cleanEmail,
        password,
        organisation_name: cleanOrganisationName,
        use_case: useCase,
        expected_participants: expectedParticipants,
        preferred_plan: preferredPlan,
      }),
    });

    const json = await response.json().catch(() => null);

    if (!response.ok || !json?.ok) {
      throw new Error(json?.error ?? "Failed to create account.");
    }

    const accessPending = Boolean(json?.data?.access_pending);

    if (accessPending) {
      setSuccessMessage(
        json?.data?.message ??
          "Account created. This organisation already exists, so your access must be approved by an organisation admin before you can view organisation data."
      );
    } else {
      setSuccessMessage(
        json?.data?.message ??
          "Account created. Your organisation has been created. You can now login and create your first project."
      );
    }

    setPassword("");
    setConfirmPassword("");
  } catch (error: any) {
    setErrorMessage(error?.message ?? "Failed to create account.");
  } finally {
    setCreating(false);
  }
}

  return (
    <main className="min-h-screen bg-[#EAF2F8] text-[#06324A]">
      <header className="border-b border-white/50 bg-[#EAF2F8] px-4 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="text-2xl font-black tracking-tight">
            <span className="text-[#0A5278]">Com</span>Connect
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-black lg:flex">
            <Link href="/#how-it-works" className="hover:text-[#0A5278]">
              How it works
            </Link>
            <Link href="/pricing" className="hover:text-[#0A5278]">
              Pricing
            </Link>
            <Link href="/#api" className="hover:text-[#0A5278]">
              API
            </Link>
          </nav>

          <Link
            href="/login"
            className="rounded-full bg-[#06324A] px-5 py-2.5 text-sm font-black text-white hover:bg-[#032A3D]"
          >
            Login
          </Link>
        </div>
      </header>

      <section className="px-4 py-12">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_500px]">
          <div className="rounded-[2.5rem] bg-[#032A3D] p-8 text-white shadow-2xl md:p-12">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#28A9E0]">
              Create account
            </p>

            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[1.04] tracking-tight md:text-7xl">
              Start a controlled ComConnect workspace.
            </h1>

            <p className="mt-7 max-w-3xl text-lg font-medium leading-8 text-white/85">
              New organisations begin with limited trial access for testing
              ComConnect with the Participant app. The monthly subscription
              covers access to ComConnect and the Participant app. SMS, voice
              calls and WhatsApp require subscription activation, provider setup
              and a funded pay-as-you-use wallet.
            </p>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {benefits.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[2rem] border border-white/15 bg-white/5 p-6"
                >
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#28A9E0]">
                    ComConnect
                  </p>
                  <h2 className="mt-6 text-2xl font-black leading-tight">
                    {item.title}
                  </h2>
                  <p className="mt-4 text-sm font-medium leading-7 text-white/75">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-[2rem] border border-white/15 bg-white/5 p-6">
              <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-[#28A9E0]">
                    Trial app download
                  </p>
                  <h2 className="mt-3 text-2xl font-black leading-tight">
                    Test with the Participant app first.
                  </h2>
                  <p className="mt-3 text-sm font-medium leading-7 text-white/75">
                    The Participant app supports two-way text, audio, video,
                    questionnaires, education content and chat. Use it for trial
                    testing before activating paid channels.
                  </p>
                </div>

                <a
                  href={PARTICIPANT_APP_URL}
                  className="rounded-full bg-white px-6 py-4 text-center text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
                >
                  Download Participant app
                </a>
              </div>
            </div>
          </div>

          <aside className="rounded-[2.5rem] border border-[#C9D8E4] bg-white p-6 shadow-xl md:p-8">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#0A5278]">
              Organisation setup
            </p>

            <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-[#06324A]">
              Create your account
            </h2>

            <p className="mt-3 text-sm font-medium leading-7 text-[#536271]">
              Use your real email and password. You will use these details to
              login after your account is confirmed.
            </p>

            {errorMessage ? (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                {successMessage}
              </div>
            ) : null}

            <form className="mt-7 space-y-4" onSubmit={handleSignup}>
              <label className="block">
                <span className="text-sm font-black text-[#06324A]">
                  Full name
                </span>
                <input
                  type="text"
                  placeholder="Your name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
                />
              </label>

              <label className="block">
                <span className="text-sm font-black text-[#06324A]">
                  Work email
                </span>
                <input
                  type="email"
                  placeholder="you@organisation.org"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
                />
              </label>

              <label className="block">
                <span className="text-sm font-black text-[#06324A]">
                  Password
                </span>
                <input
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
                />
              </label>

              <label className="block">
                <span className="text-sm font-black text-[#06324A]">
                  Confirm password
                </span>
                <input
                  type="password"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
                />
              </label>

              <label className="block">
                <span className="text-sm font-black text-[#06324A]">
                  Organisation name
                </span>
                <input
                  type="text"
                  placeholder="University, NGO, clinic or programme"
                  value={organisationName}
                  onChange={(event) => setOrganisationName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
                />
              </label>

              <label className="block">
                <span className="text-sm font-black text-[#06324A]">
                  Main use case
                </span>
                <select
                  value={useCase}
                  onChange={(event) => setUseCase(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
                >
                  {useCases.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-black text-[#06324A]">
                  Expected participants
                </span>
                <select
                  value={expectedParticipants}
                  onChange={(event) =>
                    setExpectedParticipants(event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
                >
                  <option>Under 500</option>
                  <option>500 - 5,000</option>
                  <option>5,000 - 50,000</option>
                  <option>Over 50,000</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-black text-[#06324A]">
                  Preferred plan
                </span>
                <select
                  value={preferredPlan}
                  onChange={(event) => setPreferredPlan(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
                >
                  <option>Starter / trial</option>
                  <option>Research</option>
                  <option>Care / Programme</option>
                  <option>Enterprise / API</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-full bg-[#0A5278] px-6 py-4 text-sm font-black text-white hover:bg-[#063E5E] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? "Creating account..." : "Create account"}
              </button>
            </form>

            <div className="mt-6 rounded-[1.7rem] bg-[#EAF2F8] p-5">
              <p className="text-sm font-black text-[#06324A]">
                Trial access note
              </p>
              <p className="mt-2 text-sm font-medium leading-7 text-[#536271]">
                Trial access supports Participant app testing only. SMS, voice
                calls and WhatsApp require subscription activation, provider
                setup and a funded wallet. API access is reviewed separately and
                enabled only for approved plans or add-ons.
              </p>
            </div>

            <p className="mt-6 text-center text-sm font-medium text-[#536271]">
              Already have an account?{" "}
              <Link href="/login" className="font-black text-[#0A5278]">
                Login
              </Link>
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}