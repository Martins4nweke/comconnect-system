import Link from "next/link";

export function SharpHero({
  title,
  subtitle,
  eyebrow,
  actionHref,
  actionLabel,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <section className="rounded-[2rem] bg-[#EEF3FB] py-2">
      {eyebrow ? (
        <div className="mb-4 inline-flex items-center rounded-[1.5rem] bg-[#171717] px-5 py-3 text-sm font-black text-[#FF5C1A] shadow-sm">
          {eyebrow}
          <span className="mx-4 h-6 w-[2px] bg-white/70" />
          <span className="font-semibold text-white">ComConnect</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-black md:text-5xl">
            {title}
          </h1>

          {subtitle ? (
            <p className="mt-2 max-w-4xl text-sm font-medium text-slate-600 md:text-base">
              {subtitle}
            </p>
          ) : null}
        </div>

        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="inline-flex items-center justify-center rounded-2xl bg-[#FF5C1A] px-5 py-3 text-sm font-black text-black shadow-sm transition hover:translate-y-[-1px] hover:shadow-md"
          >
            {actionLabel}
            <span className="ml-2">→</span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}