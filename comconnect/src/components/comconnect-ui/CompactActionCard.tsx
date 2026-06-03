import Link from "next/link";

export function CompactActionCard({
  title,
  description,
  href,
  tag,
  parentHref,
}: {
  title: string;
  description?: string;
  href: string;
  tag?: string;
  parentHref?: string;
}) {
  const target = parentHref ? `${href}?parent=${encodeURIComponent(parentHref)}` : href;

  return (
    <Link
      href={target}
      className="group min-w-[250px] max-w-[280px] flex-1 rounded-[1.6rem] border-2 border-[#171717] bg-white p-4 shadow-[4px_4px_0_#171717] transition hover:-translate-y-1 hover:shadow-[7px_7px_0_#171717]"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-black text-[#171717]">{title}</h3>
        {tag ? (
          <span className="rounded-full bg-[#FF5C1A] px-2.5 py-1 text-[11px] font-black text-black">
            {tag}
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">{description}</p>
      ) : null}
      <div className="mt-3 text-sm font-black text-[#FF5C1A]">
        Open <span className="transition group-hover:translate-x-1">→</span>
      </div>
    </Link>
  );
}
