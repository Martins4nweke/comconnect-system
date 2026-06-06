import Link from "next/link";

const PARTICIPANT_APP_URL =
  "https://expo.dev/accounts/rm221/projects/comconnect-participant/builds/cc98c087-89df-47ca-a93a-33e6b5c9722e";

const plans = [
  {
    name: "Starter",
    label: "Trial-ready",
    price: "Pilot",
    description:
      "For small projects, pilots and early testing with the Participant app.",
    features: [
      "ComConnect dashboard access",
      "Participant app trial testing",
      "App-based messages and chat",
      "Education content and questionnaires",
      "Basic delivery and activity logs",
      "No production SMS, voice or WhatsApp",
      "No production API access",
    ],
    cta: "Create account",
    href: "/signup",
  },
  {
    name: "Research",
    label: "Popular",
    price: "Research teams",
    description:
      "For universities, NGOs and funded health research projects.",
    features: [
      "Multiple research projects",
      "Participant app workflows",
      "Questionnaires and education library",
      "Two-way participant chat",
      "Exports and audit logs",
      "Limited project API access",
      "Paid channels through wallet",
    ],
    cta: "Start research plan",
    href: "/signup",
    highlighted: true,
  },
  {
    name: "Care / Programme",
    label: "Programme",
    price: "Care teams",
    description:
      "For clinics, community teams and multi-site health programmes.",
    features: [
      "Appointments and referrals",
      "Health check-ins and alerts",
      "Follow-up team workflows",
      "Participant app engagement",
      "Operational dashboard",
      "API add-on for approved integrations",
      "Paid channels through wallet",
    ],
    cta: "Create programme account",
    href: "/signup",
  },
  {
    name: "Enterprise",
    label: "Custom",
    price: "Custom",
    description:
      "For large organisations, government programmes and advanced integrations.",
    features: [
      "Advanced access control",
      "Full API and webhook access",
      "Custom onboarding",
      "Higher-volume operations",
      "Organisation-level reporting",
      "Integration support",
      "Custom wallet/provider setup",
    ],
    cta: "Contact team",
    href: "mailto:support@example.com",
  },
];

const billingCards = [
  {
    label: "Subscription",
    title: "ComConnect + Participant app",
    text:
      "Your monthly subscription covers access to the ComConnect dashboard, organisation/project tools, Participant app workflows, app-based messaging, questionnaires, education content, two-way chat, alerts, logs and reporting.",
  },
  {
    label: "Trial access",
    title: "Participant app testing only",
    text:
      "Trial access supports ComConnect-to-Participant app testing, including text, audio, video, education content, questionnaires and two-way chat. SMS, voice calls and WhatsApp are not included in trial access.",
  },
  {
    label: "Wallet",
    title: "SMS, voice and WhatsApp",
    text:
      "Paid channels require subscription activation, provider setup and a funded pay-as-you-use wallet. Charges are deducted per SMS, voice call or WhatsApp message.",
  },
  {
    label: "Developer API",
    title: "Approved integrations",
    text:
      "API access is available on approved subscription plans or add-ons. Any paid-channel traffic triggered through the API is still billed separately through the wallet.",
  },
];

const faqs = [
  {
    question: "Does the monthly subscription include SMS, voice or WhatsApp?",
    answer:
      "No. The monthly subscription covers access to ComConnect and the Participant app. SMS, voice calls and WhatsApp are charged separately through a pay-as-you-use wallet.",
  },
  {
    question: "What can be tested during trial access?",
    answer:
      "Trial access supports ComConnect-to-Participant app testing, including app messages, text, audio, video links, education material, questionnaires and two-way chat.",
  },
  {
    question: "When can paid communication channels be used?",
    answer:
      "SMS, voice calls and WhatsApp require an active subscription, provider setup and a funded wallet before use.",
  },
  {
    question: "Is API access included?",
    answer:
      "API access is available only on approved subscription plans or add-ons. Paid-channel usage triggered through the API is still charged from the wallet.",
  },
];

export default function PricingPage() {
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
            <Link href="/#participant-app" className="hover:text-[#0A5278]">
              Participant app
            </Link>
            <Link href="/#api" className="hover:text-[#0A5278]">
              API
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-black hover:bg-white"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-[#0A5278] px-5 py-2.5 text-sm font-black text-white hover:bg-[#063E5E]"
            >
              Create account
            </Link>
          </div>
        </div>
      </header>

      <section className="px-4 py-14">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#0A5278]">
              Pricing
            </p>

            <h1 className="mt-4 text-5xl font-black leading-[1.05] tracking-tight text-[#06324A] md:text-7xl">
              Platform access plus pay-as-you-use messaging.
            </h1>

            <p className="mt-6 max-w-3xl text-lg font-medium leading-8 text-[#536271]">
              Your monthly subscription gives access to ComConnect and the
              Participant app. SMS, voice calls and WhatsApp are paid channels
              charged separately through a funded wallet.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`flex min-h-[570px] flex-col rounded-[2rem] border p-6 shadow-sm ${
                  plan.highlighted
                    ? "border-[#0A5278] bg-white shadow-xl"
                    : "border-[#C9D8E4] bg-white"
                }`}
              >
                <div className="mb-5 w-fit rounded-full bg-[#EAF2F8] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#0A5278]">
                  {plan.label}
                </div>

                <h2 className="text-2xl font-black text-[#06324A]">
                  {plan.name}
                </h2>

                <p className="mt-3 text-sm font-medium leading-6 text-[#536271]">
                  {plan.description}
                </p>

                <p className="mt-7 text-3xl font-black text-[#06324A]">
                  {plan.price}
                </p>

                <ul className="mt-7 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex gap-3 text-sm font-bold leading-6 text-[#06324A]"
                    >
                      <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#EAF2F8] text-[11px] font-black text-[#0A5278]">
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={`mt-8 rounded-full px-6 py-4 text-center text-sm font-black ${
                    plan.highlighted
                      ? "bg-[#0A5278] text-white hover:bg-[#063E5E]"
                      : "bg-[#06324A] text-white hover:bg-[#032A3D]"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <section className="mt-12 overflow-hidden rounded-[2.5rem] bg-[#032A3D] text-white shadow-2xl">
            <div className="border-b border-white/15 px-6 py-8 md:px-10 md:py-10">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-[#28A9E0]">
                Billing model
              </p>

              <h2 className="mt-4 max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
                One subscription for access. A separate wallet for paid
                channels.
              </h2>

              <p className="mt-5 max-w-5xl text-base font-medium leading-8 text-white/80">
                The monthly subscription covers access to ComConnect and the
                Participant app. SMS, voice calls and WhatsApp are not included
                in the subscription; they are charged separately per message or
                call through a pay-as-you-use wallet.
              </p>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-4">
              {billingCards.map((item) => (
                <div
                  key={item.label}
                  className="min-h-[380px] border-t border-white/15 p-6 md:border-r xl:border-t-0"
                >
                  <div className="flex h-full flex-col justify-between">
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.18em] text-white/55">
                        {item.label}
                      </p>

                      <h3 className="mt-8 text-2xl font-black leading-tight text-white">
                        {item.title}
                      </h3>

                      <p className="mt-5 text-sm font-medium leading-7 text-white/75">
                        {item.text}
                      </p>
                    </div>

                    <div className="mt-8 flex items-center justify-between border-t border-white/20 pt-5">
                      <span className="text-sm font-black uppercase tracking-[0.18em] text-white/55">
                        Details
                      </span>
                      <span className="grid h-11 w-11 place-items-center rounded-full border border-[#28A9E0] text-2xl font-light text-white">
                        +
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_420px]">
            <div className="rounded-[2.5rem] border border-[#C9D8E4] bg-white p-8 shadow-sm md:p-10">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-[#0A5278]">
                Participant app
              </p>

              <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight text-[#06324A] md:text-5xl">
                Download the Participant app for trial testing.
              </h2>

              <p className="mt-5 text-base font-medium leading-8 text-[#536271]">
                The Participant app supports text, audio, video,
                questionnaires, education content and two-way chat between
                participants and the project team. Use it to test ComConnect
                app-based workflows before activating paid SMS, voice call or
                WhatsApp channels.
              </p>

              <a
                href={PARTICIPANT_APP_URL}
                className="mt-8 inline-flex rounded-full bg-[#0A5278] px-7 py-4 text-sm font-black text-white hover:bg-[#063E5E]"
              >
                Download Participant app
              </a>
            </div>

            <div className="rounded-[2.5rem] bg-[#06324A] p-8 text-white shadow-sm md:p-10">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-[#28A9E0]">
                Developer API
              </p>

              <h2 className="mt-4 text-3xl font-black leading-tight">
                API access for approved subscriptions.
              </h2>

              <p className="mt-5 text-sm font-medium leading-7 text-white/75">
                Connect approved organisational systems to participant records,
                app-first messaging, questionnaires, education assignments,
                replies, alerts and delivery logs.
              </p>

              <p className="mt-4 text-sm font-medium leading-7 text-white/75">
                API access does not include free SMS, voice or WhatsApp usage.
                Paid-channel traffic triggered through the API is still charged
                through the wallet.
              </p>

              <Link
                href="/app-api"
                className="mt-8 inline-flex rounded-full bg-white px-7 py-4 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
              >
                View API console
              </Link>
            </div>
          </section>

          <section className="mt-12 rounded-[2.5rem] border border-[#C9D8E4] bg-white p-8 shadow-sm md:p-10">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#0A5278]">
              Common questions
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {faqs.map((item) => (
                <div
                  key={item.question}
                  className="rounded-[2rem] border border-[#C9D8E4] bg-[#EAF2F8] p-6"
                >
                  <h3 className="text-lg font-black text-[#06324A]">
                    {item.question}
                  </h3>
                  <p className="mt-3 text-sm font-medium leading-7 text-[#536271]">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12 rounded-[2.5rem] bg-[#06324A] p-8 text-white shadow-xl md:p-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.24em] text-[#28A9E0]">
                  Start trial
                </p>
                <h2 className="mt-4 max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
                  Test ComConnect with the Participant app first.
                </h2>
                <p className="mt-5 max-w-3xl text-base font-medium leading-8 text-white/80">
                  Trial access supports Participant app testing only. Paid
                  channels such as SMS, voice calls and WhatsApp require
                  subscription activation and a funded wallet.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link
                  href="/signup"
                  className="rounded-full bg-white px-7 py-4 text-center text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
                >
                  Create account
                </Link>

                <a
                  href={PARTICIPANT_APP_URL}
                  className="rounded-full border border-white/30 px-7 py-4 text-center text-sm font-black text-white hover:bg-white/10"
                >
                  Download Participant app
                </a>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}