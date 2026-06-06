"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const PARTICIPANT_APP_URL =
  "https://expo.dev/accounts/rm221/projects/comconnect-participant/builds/cc98c087-89df-47ca-a93a-33e6b5c9722e";

const loginHighlights = [
  "Participant app text, audio, video and chat",
  "Research questionnaires and education workflows",
  "Care alerts, referrals and appointments",
  "Delivery logs, replies and audit-ready activity",
];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectedFrom = searchParams.get("redirectedFrom") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setErrorMessage("Enter your email address.");
      return;
    }

    if (!password) {
      setErrorMessage("Enter your password.");
      return;
    }

    setLoggingIn(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      router.replace(redirectedFrom);
      router.refresh();
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Login failed. Please try again.");
    } finally {
      setLoggingIn(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#EAF2F8] text-[#06324A]">
      <section className="px-4 py-6">
        <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-7xl items-center justify-center">
          <div className="grid w-full overflow-hidden rounded-[2.5rem] bg-white shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
            <section className="bg-[#032A3D] p-8 text-white md:p-12">
              <div className="flex items-center justify-between gap-4">
                <Link href="/" className="text-2xl font-black tracking-tight">
                  <span className="text-[#28A9E0]">Com</span>Connect
                </Link>

                <Link
                  href="/pricing"
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-black text-white hover:bg-white/10"
                >
                  Pricing
                </Link>
              </div>

              <div className="mt-16">
                <p className="text-sm font-black uppercase tracking-[0.24em] text-[#28A9E0]">
                  Login
                </p>

                <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[1.05] tracking-tight md:text-7xl">
                  Return to your communication command centre.
                </h1>

                <p className="mt-7 max-w-2xl text-lg font-medium leading-8 text-white/80">
                  Sign in securely to manage participants, projects, app-first
                  messaging, questionnaires, education content, replies, alerts
                  and delivery outcomes.
                </p>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {loginHighlights.map((item) => (
                  <div
                    key={item}
                    className="rounded-[2rem] border border-white/15 bg-white/5 p-5"
                  >
                    <p className="text-sm font-black leading-6 text-white">
                      {item}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-10 rounded-[2rem] border border-white/15 bg-white/5 p-6">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#28A9E0]">
                  Trial users
                </p>
                <h2 className="mt-3 text-2xl font-black leading-tight">
                  Test with the Participant app first.
                </h2>
                <p className="mt-3 text-sm font-medium leading-7 text-white/75">
                  Trial access supports ComConnect-to-Participant app testing.
                  SMS, voice calls and WhatsApp require subscription activation
                  and a funded pay-as-you-use wallet.
                </p>

                <a
                  href={PARTICIPANT_APP_URL}
                  className="mt-5 inline-flex rounded-full bg-white px-6 py-3 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
                >
                  Download Participant app
                </a>
              </div>
            </section>

            <section className="flex items-center p-6 md:p-10">
              <div className="w-full">
                <div className="mb-8">
                  <p className="text-sm font-black uppercase tracking-[0.24em] text-[#0A5278]">
                    Welcome back
                  </p>
                  <h2 className="mt-3 text-3xl font-black tracking-tight text-[#06324A]">
                    Login to ComConnect
                  </h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-[#536271]">
                    Use your organisation account to continue.
                  </p>
                </div>

                {errorMessage ? (
                  <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                    {errorMessage}
                  </div>
                ) : null}

                <form className="space-y-5" onSubmit={handleLogin}>
                  <label className="block">
                    <span className="text-sm font-black text-[#06324A]">
                      Email address
                    </span>
                    <input
                      type="email"
                      placeholder="you@example.com"
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
                      placeholder="Your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      className="mt-2 w-full rounded-2xl border border-[#C9D8E4] bg-white px-4 py-3 text-sm font-bold text-[#06324A] outline-none focus:border-[#0A5278]"
                    />
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <label className="flex items-center gap-2 font-bold text-[#536271]">
                      <input type="checkbox" />
                      Remember me
                    </label>

                    <a
                      href="mailto:support@example.com"
                      className="font-black text-[#0A5278]"
                    >
                      Need help?
                    </a>
                  </div>

                  <button
                    type="submit"
                    disabled={loggingIn}
                    className="w-full rounded-full bg-[#0A5278] px-6 py-4 text-sm font-black text-white hover:bg-[#063E5E] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loggingIn ? "Signing in..." : "Continue to dashboard"}
                  </button>
                </form>

                <div className="mt-6 rounded-[1.7rem] bg-[#EAF2F8] p-5">
                  <p className="text-sm font-black text-[#06324A]">
                    Billing reminder
                  </p>
                  <p className="mt-2 text-sm font-medium leading-7 text-[#536271]">
                    Your subscription covers access to ComConnect and the
                    Participant app. SMS, voice calls and WhatsApp are charged
                    separately through a pay-as-you-use wallet.
                  </p>
                </div>

                <p className="mt-6 text-center text-sm font-medium text-[#536271]">
                  New to ComConnect?{" "}
                  <Link href="/signup" className="font-black text-[#0A5278]">
                    Create an account
                  </Link>{" "}
                  or{" "}
                  <Link href="/pricing" className="font-black text-[#0A5278]">
                    view pricing
                  </Link>
                  .
                </p>

                <p className="mt-4 text-center text-sm font-medium text-[#536271]">
                  Testing a trial workspace?{" "}
                  <a
                    href={PARTICIPANT_APP_URL}
                    className="font-black text-[#0A5278]"
                  >
                    Download the Participant app
                  </a>
                  .
                </p>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}