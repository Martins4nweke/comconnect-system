import Link from "next/link";

export const dynamic = "force-dynamic";

const audiences = [
  {
    title: "Hospitals and clinics",
    subtitle: "Connect patient systems to follow-up communication",
    problem:
      "Hospitals often lose patients after discharge, referral, missed appointments or chronic disease reviews because communication is manual and fragmented.",
    solution:
      "ComConnect API allows hospital systems to register patients as participants, trigger reminders, queue follow-up messages and read delivery outcomes.",
    examples: [
      "Appointment reminders",
      "Post-discharge follow-up",
      "Referral reminders",
      "Medication adherence support",
      "Hypertension, diabetes and maternal care follow-up",
      "Missed clinic visit tracing",
    ],
    apiFlow: [
      "Hospital system creates or updates participant",
      "Hospital triggers app-first message or scheduled reminder",
      "ComConnect queues paid channels only when required",
      "Delivery logs and failed-message reasons return to the hospital system",
    ],
    value:
      "Reduces missed appointments, improves continuity of care and gives proof of patient communication.",
  },
  {
    title: "Universities and research teams",
    subtitle: "Automate participant engagement and research fidelity tracking",
    problem:
      "Research teams need to deliver intervention messages consistently, monitor participant engagement and prove communication fidelity for ethics, audit and reporting.",
    solution:
      "ComConnect API connects research databases to participant registration, scheduled messages, app messages, delivery logs, replies and help requests.",
    examples: [
      "Clinical trial communication",
      "Community intervention messaging",
      "Longitudinal participant follow-up",
      "Education-based health interventions",
      "Fieldwork coordination",
      "Delivery and fidelity monitoring",
    ],
    apiFlow: [
      "Research database registers participants through API",
      "Study team schedules intervention messages",
      "Participants receive app messages or guarded fallback channels",
      "Delivery logs, replies and help requests are available for monitoring",
    ],
    value:
      "Improves research fidelity by documenting who was contacted, when, through which channel and with what outcome.",
  },
  {
    title: "NGOs and community programmes",
    subtitle: "Reach beneficiaries through app-first multichannel engagement",
    problem:
      "NGOs often work with large community groups where follow-up, education, alerts and field-worker coordination become difficult at scale.",
    solution:
      "ComConnect API allows NGOs to connect beneficiary lists, field-worker tools and programme dashboards to a controlled communication engine.",
    examples: [
      "Maternal and child health campaigns",
      "HIV/TB adherence support",
      "Vaccination reminders",
      "Community education alerts",
      "Food support and welfare communication",
      "Beneficiary follow-up and help requests",
    ],
    apiFlow: [
      "NGO system creates beneficiaries as participants",
      "Programme team sends education or alert messages",
      "ComConnect delivers through app, push or guarded paid channels",
      "Delivery logs and replies support programme monitoring",
    ],
    value:
      "Supports scalable community engagement while keeping communication traceable, project-aware and safer than raw bulk messaging.",
  },
];

const apiPackages = [
  {
    name: "Participant Sync API",
    endpoints: ["GET /api/external/participants", "POST /api/external/participants"],
    benefit:
      "Register and read participants automatically from hospital, university or NGO systems.",
  },
  {
    name: "Message API",
    endpoints: ["GET /api/external/messages", "POST /api/external/messages/send"],
    benefit:
      "Publish app messages immediately and queue push, SMS, WhatsApp or voice through controlled workflows.",
  },
  {
    name: "Schedule API",
    endpoints: ["GET /api/external/schedules", "POST /api/external/schedules"],
    benefit:
      "Create and monitor scheduled communication tasks for reminders, interventions and follow-up.",
  },
  {
    name: "Monitoring API",
    endpoints: ["GET /api/external/delivery-logs", "GET /api/external/replies"],
    benefit:
      "Read delivery outcomes, failures, replies and help requests for reporting and action.",
  },
  {
    name: "Webhook API",
    endpoints: ["GET /api/external/webhooks", "POST /api/external/webhooks/test"],
    benefit:
      "Connect ComConnect events back to approved external systems without exposing webhook secrets.",
  },
];

const safeguards = [
  "API access is organisation-scoped and may also be project-scoped.",
  "API keys use scopes, so each integration receives only the permissions it needs.",
  "Messages can only be sent to registered participants using participant_id or participant_code.",
  "Raw phone-number-only sending is not supported in this version.",
  "Only in-app app messages are non-wallet messages.",
  "Push, SMS, WhatsApp and voice are controlled channels.",
  "SMS, WhatsApp and voice must pass subscription, wallet and channel checks before provider sending.",
  "Delivery logs, replies and help requests remain traceable for audit and reporting.",
];

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[#EAF2F8] px-3 py-1 text-xs font-black text-[#06324A]">
      {children}
    </span>
  );
}

export default function ApiUseCasesPage() {
  return (
    <main className="min-h-screen bg-[#EAF2F8] px-4 py-6 text-[#06324A]">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] bg-[#032A3D] p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#28A9E0]">
            ComConnect API use cases
          </p>

          <div className="mt-4 grid gap-5 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                Connect hospitals, universities and NGOs to ComConnect
              </h1>
              <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-white/80">
                ComConnect API helps organisations connect existing systems to
                participant registration, app-first messaging, scheduled
                reminders, delivery logs, replies, help requests and webhook
                events.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                Core value
              </p>
              <p className="mt-2 text-xl font-black text-white">
                System-to-system health communication
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-white/70">
                External systems can trigger ComConnect workflows without
                bypassing organisation, project, wallet, delivery-log or
                consent-aware safeguards.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/app-api"
              className="rounded-full bg-white px-5 py-3 text-sm font-black text-[#06324A] hover:bg-[#EAF2F8]"
            >
              Developer API reference
            </Link>
            <Link
              href="/api-keys"
              className="rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/20"
            >
              Manage API keys
            </Link>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {audiences.map((item) => (
            <div
              key={item.title}
              className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm"
            >
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
                {item.title}
              </p>
              <h2 className="mt-3 text-2xl font-black text-[#06324A]">
                {item.subtitle}
              </h2>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-red-700">
                    Problem
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6 text-red-800">
                    {item.problem}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                    ComConnect solution
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6 text-emerald-800">
                    {item.solution}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0A5278]">
                  Common uses
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.examples.map((example) => (
                    <Pill key={example}>{example}</Pill>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0A5278]">
                  Example API flow
                </p>
                <div className="mt-3 space-y-2">
                  {item.apiFlow.map((step, index) => (
                    <div
                      key={step}
                      className="rounded-2xl border border-[#C9D8E4] bg-[#F7FBFD] px-4 py-3 text-sm font-bold leading-6 text-[#536271]"
                    >
                      <span className="mr-2 font-black text-[#0A5278]">
                        {index + 1}.
                      </span>
                      {step}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0A5278]">
                  Value
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-[#06324A]">
                  {item.value}
                </p>
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
            API integration packages
          </p>
          <h2 className="mt-3 text-2xl font-black text-[#06324A]">
            What organisations can integrate
          </h2>
          <p className="mt-3 max-w-4xl text-sm font-bold leading-6 text-[#536271]">
            The API can be presented as practical integration packages rather
            than only as technical endpoints. This makes it easier for decision
            makers to understand how ComConnect connects to their existing
            hospital, research or NGO systems.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {apiPackages.map((item) => (
              <div
                key={item.name}
                className="rounded-2xl border border-[#C9D8E4] bg-[#F7FBFD] p-4"
              >
                <h3 className="text-sm font-black text-[#06324A]">
                  {item.name}
                </h3>
                <div className="mt-3 space-y-2">
                  {item.endpoints.map((endpoint) => (
                    <code
                      key={endpoint}
                      className="block rounded-xl bg-white px-3 py-2 text-[11px] font-black text-[#0A5278]"
                    >
                      {endpoint}
                    </code>
                  ))}
                </div>
                <p className="mt-3 text-xs font-bold leading-5 text-[#536271]">
                  {item.benefit}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-[2rem] border border-[#C9D8E4] bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
              Safeguards
            </p>
            <h2 className="mt-3 text-2xl font-black text-[#06324A]">
              Why the API is safe for health and research use
            </h2>

            <div className="mt-5 grid gap-3">
              {safeguards.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-[#C9D8E4] bg-[#EAF2F8] px-4 py-3 text-sm font-bold text-[#06324A]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-orange-200 bg-orange-50 p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">
              Positioning statement
            </p>
            <h2 className="mt-3 text-2xl font-black text-[#06324A]">
              How to explain ComConnect API
            </h2>
            <p className="mt-4 text-sm font-bold leading-7 text-orange-900">
              ComConnect API allows hospitals, universities and NGOs to connect
              their existing systems to a secure multichannel communication
              engine. It supports participant registration, app-first messaging,
              scheduled reminders, delivery monitoring, replies, help requests
              and webhook events, while ensuring that paid channels such as SMS,
              WhatsApp and voice remain controlled by subscription, wallet and
              project permissions.
            </p>

            <div className="mt-5 grid gap-3">
              <Link
                href="/app-api"
                className="rounded-full bg-[#0A5278] px-5 py-3 text-center text-sm font-black text-white hover:bg-[#063E5E]"
              >
                Open Developer API
              </Link>
              <Link
                href="/api-keys"
                className="rounded-full border border-orange-200 bg-white px-5 py-3 text-center text-sm font-black text-[#06324A] hover:bg-orange-100"
              >
                Create API key
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}