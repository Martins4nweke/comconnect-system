import Link from "next/link";
import { moduleGroups } from "@/lib/comconnect-ui/theme";

type Card = {
  title: string;
  href: string;
  description: string;
  tag: string;
};

function ModuleCard({ card }: { card: Card }) {
  return (
    <Link
      href={card.href}
      className="group rounded-[1.35rem] border-2 border-[#171717] bg-white p-4 shadow-[3px_3px_0_#171717] transition hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#171717]"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFF1EA] text-base font-black text-[#FF5C1A]">
          {card.title.slice(0, 1)}
        </div>

        <span className="rounded-full border border-[#171717] bg-white px-2.5 py-1 text-[11px] font-black uppercase text-[#171717]">
          {card.tag}
        </span>
      </div>

      <h3 className="text-base font-black leading-tight text-[#171717]">
        {card.title}
      </h3>

      <p className="mt-1.5 line-clamp-2 text-xs font-bold leading-5 text-slate-600">
        {card.description}
      </p>

      <p className="mt-3 text-xs font-black text-[#FF5C1A] group-hover:underline">
        Open →
      </p>
    </Link>
  );
}

function ModuleSection({
  title,
  subtitle,
  cards,
}: {
  title: string;
  subtitle: string;
  cards: Card[];
}) {
  return (
    <section className="rounded-[1.75rem] border-2 border-[#171717] bg-white/70 p-4 shadow-[4px_4px_0_#171717]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#171717]">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {subtitle}
          </p>
        </div>

        <span className="rounded-full bg-[#FFF1EA] px-3 py-1 text-xs font-black text-[#FF5C1A]">
          {cards.length} modules
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <ModuleCard key={card.href} card={card} />
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  const quickStats = [
    { label: "Core channels", value: "App · SMS · Voice" },
    { label: "Fallback flow", value: "Push → SMS → Voice" },
    { label: "Platform mode", value: "Research + Care + API" },
    { label: "Status", value: "Project-aware" },
  ];

  return (
    <main className="min-h-screen bg-[#EEF3FB] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[2rem] border-2 border-[#171717] bg-white p-5 shadow-[5px_5px_0_#171717] md:p-7">
          <div className="mb-5 inline-flex flex-wrap items-center rounded-[1.5rem] bg-[#171717] px-5 py-3 text-sm font-black text-[#FF5C1A]">
            ComConnect
            <span className="mx-4 h-6 w-[2px] bg-white/70" />
            <span className="font-semibold text-white">
              Multichannel health communication and participant engagement platform
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-black md:text-6xl">
                ComConnect Dashboard
              </h1>
              <p className="mt-3 max-w-3xl text-base font-semibold leading-7 text-slate-600">
                Manage participants, messages, scheduling, care workflows,
                research modules, automation, billing and commercial API access
                from one compact dashboard.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {quickStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[1.25rem] border-2 border-[#171717] bg-[#FFF1EA] p-3 shadow-[2px_2px_0_#171717]"
                >
                  <p className="text-xs font-black uppercase text-slate-500">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-sm font-black text-[#171717]">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <ModuleSection
            title="Core Communication"
            subtitle="Create, schedule, send and track multichannel communication."
            cards={moduleGroups.mainDashboard.coreCommunication}
          />

          <ModuleSection
            title="Participant Management"
            subtitle="Manage people, projects, groups, organisations and teams."
            cards={moduleGroups.mainDashboard.participants}
          />

          <ModuleSection
            title="Research + Care"
            subtitle="Education, questionnaires, consent, appointments, referrals and chat."
            cards={moduleGroups.mainDashboard.researchCare}
          />

          <ModuleSection
            title="Automation + Safety"
            subtitle="Fallback rules, push queue, voice tasks and operations."
            cards={moduleGroups.mainDashboard.automationSafety}
          />

          <section className="xl:col-span-2">
            <ModuleSection
              title="Platform + Commercial API"
              subtitle="Billing, API access, webhooks, usage, audit logs and project settings."
              cards={moduleGroups.mainDashboard.platformApi}
            />
          </section>
        </div>
      </div>
    </main>
  );
}