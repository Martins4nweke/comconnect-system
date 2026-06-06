import Link from "next/link";

const PARTICIPANT_APP_URL =
  "https://expo.dev/accounts/rm221/projects/comconnect-participant/builds/cc98c087-89df-47ca-a93a-33e6b5c9722e";

const features = [
  {
    title: "Participant App",
    text: "Maintain two-way communication with participants, send text, audio, video, education content and questionnaires, then monitor replies, progress and engagement from one ComConnect dashboard.",
  },
  {
    title: "Research workflows",
    text: "Create participant lists, education libraries, questionnaires, schedules, responses and exports for research studies.",
  },
  {
    title: "Care continuity",
    text: "Track follow-up needs, referrals, appointments, alerts and participant responses so fewer people are lost across the care pathway.",
  },
  {
    title: "Delivery visibility",
    text: "Track app engagement, replies, delivery logs, alerts and participant activity from one operational dashboard.",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Create your workspace",
    text: "Set up your organisation, project, team members, participants and communication workflow.",
  },
  {
    step: "02",
    title: "Test with the Participant app",
    text: "Use trial access to test app-based messaging, text, audio, video, education material, questionnaires and two-way chat.",
  },
  {
    step: "03",
    title: "Activate paid channels",
    text: "When ready, activate SMS, voice calls and WhatsApp with subscription approval, provider setup and a funded wallet.",
  },
  {
    step: "04",
    title: "Reduce loss to follow-up",
    text: "Monitor replies, alerts, questionnaire responses, education progress, missed engagement and care-pathway activity so teams can act early.",
  },
];

const billingCards = [
  {
    label: "Subscription",
    title: "ComConnect + Participant app",
    text: "The monthly subscription covers access to the ComConnect dashboard, organisation/project tools, Participant app workflows, app-based messaging, questionnaires, education content, two-way chat, alerts, logs and reporting.",
  },
  {
    label: "Trial access",
    title: "Participant app testing only",
    text: "Trial access supports ComConnect-to-Participant app testing. SMS, voice calls and WhatsApp are not included in trial access.",
  },
  {
    label: "Wallet",
    title: "SMS, voice and WhatsApp",
    text: "Paid communication channels require subscription activation, provider setup and a funded pay-as-you-use wallet. Charges are deducted per SMS, voice call or WhatsApp message.",
  },
  {
    label: "Developer API",
    title: "Approved integrations",
    text: "API access is available on approved subscription plans or add-ons. Any SMS, voice or WhatsApp traffic triggered through the API is still billed through the wallet.",
  },
];

const audience = [
  "Universities and research teams",
  "Hospitals and clinics",
  "Public health programmes",
  "NGOs and implementation partners",
  "Community intervention teams",
  "Organisations needing secure participant engagement",
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#EAF2F8] text-[#06324A]">
      <header className="sticky top-0 z-30 border-b border-white/40 bg-[#EAF2F8]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="text-2xl font-black tracking-tight">
            <span className="text-[#0A5278]">Com</span>Connect
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-black text-[#06324A] lg:flex">
            <a href="#how-it-works" className="hover:text-[#0A5278]">
              How it works
            </a>
            <a href="#participant-app" className="hover:text-[#0A5278]">
              Participant app
            </a>
            <a href="#billing" className="hover:text-[#0A5278]">
              Billing
            </a>
            <a href="#api" className="hover:text-[#0A5278]">
              API
            </a>
            <Link href="/pricing" className="hover:text-[#0A5278]">
              Pricing
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-black text-[#06324A] hover:bg-white"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-[#0A5278] px-5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-[#063E5E]"
            >
              Create account
            </Link>
          </div>
        </div>
      </header>

      <section className="px-4 py-8 md:py-12">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-[#032A3D] shadow-2xl">
          <div className="grid min-h-[680px] lg:grid-cols-[1.1fr_0.9fr]">
            <div className="flex flex-col justify-between p-8 text-white md:p-14">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.28em] text-[#28A9E0]">
                  Health-first communication platform
                </p>

                <h1 className="mt-8 max-w-4xl text-5xl font-black leading-[1.04] tracking-tight md:text-7xl">
                  Two-way participant engagement through text, audio, video and
                  chat.
                </h1>

                <p className="mt-7 max-w-3xl text-lg font-medium leading-8 text-white/85 md:text-xl">
                  ComConnect helps research, health and care teams maintain
                  two-way communication with participants, reduce loss to
                  follow-up, monitor progress and manage follow-up across the
                  care pathway through the Participant app, with paid SMS, voice
                  and WhatsApp channels available when activated.
                </p>

                <div className="mt-9 flex flex-wrap gap-3">
                  <Link
                    href="/signup"
                    className="rounded-full bg-white px-7 py-4 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
                  >
                    Create account
                  </Link>

                  <a
                    href={PARTICIPANT_APP_URL}
                    className="rounded-full border border-white/30 px-7 py-4 text-sm font-black text-white hover:bg-white/10"
                  >
                    Download Participant app
                  </a>

                  <Link
                    href="/pricing"
                    className="rounded-full border border-white/30 px-7 py-4 text-sm font-black text-white hover:bg-white/10"
                  >
                    View pricing
                  </Link>
                </div>
              </div>

              <div className="mt-12 grid gap-3 sm:grid-cols-3">
                {[
                  ["Trial", "Participant app testing"],
                  ["Channels", "App, SMS, voice, WhatsApp"],
                  ["Billing", "Subscription + wallet"],
                ].map(([title, text]) => (
                  <div
                    key={title}
                    className="rounded-[1.7rem] border border-white/15 bg-white/5 p-5"
                  >
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-white/55">
                      {title}
                    </p>
                    <p className="mt-3 text-lg font-black leading-tight text-white">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-white/15 lg:border-l lg:border-t-0">
              <div className="grid h-full sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {features.map((item) => (
                  <div
                    key={item.title}
                    className="min-h-[240px] border-b border-white/15 p-7 text-white sm:border-r lg:border-r-0 xl:border-r"
                  >
                    <div className="flex h-full flex-col justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#28A9E0]">
                          Platform
                        </p>
                        <h2 className="mt-7 text-2xl font-black leading-tight">
                          {item.title}
                        </h2>
                        <p className="mt-4 text-sm font-medium leading-7 text-white/75">
                          {item.text}
                        </p>
                      </div>

                      <div className="mt-8 flex items-center justify-between border-t border-white/20 pt-5">
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-white/50">
                          Explore
                        </span>
                        <span className="grid h-11 w-11 place-items-center rounded-full border border-[#28A9E0] text-2xl font-light text-white">
                          +
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-4 py-14">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-[#0A5278]">
                How it works
              </p>
              <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight text-[#06324A] md:text-6xl">
                From trial testing to production engagement.
              </h2>
              <p className="mt-5 text-base font-medium leading-8 text-[#536271]">
                Start with the Participant app, then activate paid channels only
                when your organisation is ready.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {howItWorks.map((item) => (
                <div
                  key={item.step}
                  className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm"
                >
                  <p className="text-sm font-black text-[#0A5278]">
                    {item.step}
                  </p>
                  <h3 className="mt-6 text-2xl font-black leading-tight text-[#06324A]">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-sm font-medium leading-7 text-[#536271]">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="participant-app" className="px-4 py-14">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2.5rem] border border-[#C9D8E4] bg-white shadow-sm lg:grid-cols-[1fr_420px]">
          <div className="p-8 md:p-12">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#0A5278]">
              Participant app
            </p>

            <h2 className="mt-4 max-w-4xl text-4xl font-black leading-tight tracking-tight text-[#06324A] md:text-6xl">
              The Participant app for two-way text, audio, video,
              questionnaires and chat.
            </h2>

            <p className="mt-5 max-w-4xl text-base font-medium leading-8 text-[#536271]">
              The Participant app supports two-way communication between the
              project team and participants. It can be used during trial access
              to test messages, education material, questionnaires, audio/video
              links and chat before activating paid channels.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={PARTICIPANT_APP_URL}
                className="rounded-full bg-[#0A5278] px-7 py-4 text-sm font-black text-white hover:bg-[#063E5E]"
              >
                Download Participant app
              </a>

              <Link
                href="/signup"
                className="rounded-full border border-[#C9D8E4] px-7 py-4 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
              >
                Start trial
              </Link>
            </div>
          </div>

          <div className="border-t border-[#C9D8E4] bg-[#EAF2F8] p-8 lg:border-l lg:border-t-0">
            <div className="space-y-4">
              {[
                "Two-way text communication",
                "Audio and video link support",
                "Questionnaires and form responses",
                "Education content and progress tracking",
                "Offline-friendly participant workflows",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-[#C9D8E4] bg-white px-5 py-4 text-sm font-black text-[#06324A]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="billing" className="px-4 py-14">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-[#032A3D] text-white shadow-2xl">
          <div className="border-b border-white/15 px-6 py-8 md:px-10 md:py-10">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#28A9E0]">
              Billing model
            </p>
            <h2 className="mt-4 max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
              One subscription for access. A separate wallet for paid channels.
            </h2>
            <p className="mt-5 max-w-5xl text-base font-medium leading-8 text-white/80">
              The monthly subscription covers access to ComConnect and the
              Participant app. SMS, voice calls and WhatsApp are not included in
              the subscription; they are charged separately per message or call
              through a pay-as-you-use wallet.
            </p>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4">
            {billingCards.map((item) => (
              <div
                key={item.label}
                className="min-h-[360px] border-t border-white/15 p-6 md:border-r xl:border-t-0"
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
        </div>
      </section>

      <section id="api" className="px-4 py-14">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_430px]">
          <div className="rounded-[2.5rem] border border-[#C9D8E4] bg-white p-8 shadow-sm md:p-12">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#0A5278]">
              Developer API
            </p>

            <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight text-[#06324A] md:text-6xl">
              Controlled API access for approved organisations.
            </h2>

            <p className="mt-5 text-base font-medium leading-8 text-[#536271]">
              ComConnect can expose project-scoped APIs for approved
              organisations and developers who need to connect participant
              records, app-first messages, questionnaires, education
              assignments, replies, delivery logs and alerts into existing
              systems.
            </p>

            <p className="mt-4 text-base font-medium leading-8 text-[#536271]">
              API access is subscription-based or add-on based. SMS, voice or
              WhatsApp traffic triggered through the API is still billed
              separately through the pay-as-you-use wallet.
            </p>
          </div>

          <div className="rounded-[2.5rem] bg-[#06324A] p-8 text-white shadow-sm">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#28A9E0]">
              API use cases
            </p>

            <div className="mt-8 space-y-4">
              {[
                "Create or update participants",
                "Trigger app-first messages",
                "Assign questionnaires",
                "Assign education material",
                "Read replies and alerts",
                "Fetch delivery logs",
                "Connect external systems",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-black text-white"
                >
                  {item}
                </div>
              ))}
            </div>

            <Link
              href="/pricing"
              className="mt-8 inline-flex rounded-full bg-white px-7 py-4 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
            >
              View API plans
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-14">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-[#0A5278]">
                Built for
              </p>
              <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight text-[#06324A] md:text-6xl">
                Health, research and community programmes.
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {audience.map((item) => (
                <div
                  key={item}
                  className="rounded-full border-2 border-[#0A5278] px-5 py-4 text-center text-sm font-black text-[#06324A]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 pt-6">
        <div className="mx-auto max-w-7xl rounded-[2.5rem] bg-[#06324A] p-8 text-white shadow-xl md:p-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-[#28A9E0]">
                Start trial
              </p>
              <h2 className="mt-4 max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
                Test ComConnect with the Participant app first.
              </h2>
              <p className="mt-5 max-w-3xl text-base font-medium leading-8 text-white/80">
                Trial access supports Participant app testing. Paid channels
                such as SMS, voice calls and WhatsApp require subscription
                activation and a funded wallet.
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
        </div>
      </section>
    </main>
  );
}