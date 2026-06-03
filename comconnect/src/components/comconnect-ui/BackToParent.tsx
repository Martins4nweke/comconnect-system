import Link from "next/link";

export function BackToParent({ href, label = "Back to parent page" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full border-2 border-[#171717] bg-white px-4 py-2 text-sm font-black text-[#171717] transition hover:bg-[#171717] hover:text-white"
    >
      ← {label}
    </Link>
  );
}
