import Link from "next/link";

export function ThickButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-2xl bg-[#FF5C1A] px-5 py-3 text-sm font-bold text-black shadow-sm transition hover:translate-y-[-1px] hover:shadow-md"
    >
      {children}
      <span className="ml-2">→</span>
    </Link>
  );
}
