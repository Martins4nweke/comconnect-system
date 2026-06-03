import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-2">
          {item.href ? (
            <Link href={item.href} className="font-bold text-slate-900 hover:text-[#FF5C1A]">
              {item.label}
            </Link>
          ) : (
            <span className="font-black text-[#FF5C1A]">{item.label}</span>
          )}
          {index < items.length - 1 ? <span className="text-slate-400">/</span> : null}
        </span>
      ))}
    </nav>
  );
}
