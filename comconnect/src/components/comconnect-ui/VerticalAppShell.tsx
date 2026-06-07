"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { sidebarNavigation } from "@/lib/comconnect-ui/navigation";
import { type Permission, userCan } from "@/lib/comconnect-core/permissions";

type VerticalAppShellProps = {
  children: ReactNode;
  organisationRole?: string | null;
  projectRole?: string | null;
  organisationName?: string;
  projectName?: string;
};

type NavigationItemForVisibility = {
  permission: Permission;
  superadminOnly?: boolean;
};

export function VerticalAppShell({
  children,
  organisationRole = "organisation_admin",
  projectRole = "project_manager",
  organisationName = "Current organisation",
  projectName = "Current project",
}: VerticalAppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  function can(permission: Permission) {
    return userCan({
      organisationRole,
      projectRole,
      permission,
    });
  }

  function isSuperadminUser() {
    const role = String(organisationRole ?? "").trim().toLowerCase();

    return role === "platform_owner" || role === "superadmin";
  }

  function canSeeNavigationItem(item: NavigationItemForVisibility) {
    if (item.superadminOnly && !isSuperadminUser()) {
      return false;
    }

    return can(item.permission);
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const visibleNavigation = sidebarNavigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canSeeNavigationItem(item)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen bg-[#EAF2F8]">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-[#C9D8E4] bg-white px-4 py-5 shadow-sm lg:block">
          <Link href="/dashboard" className="block">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0A5278]">
              ComConnect
            </p>
            <h1 className="mt-1 text-xl font-black text-[#06324A]">
              Control Centre
            </h1>
          </Link>

          <div className="mt-5 rounded-2xl bg-[#EAF2F8] p-3">
            <p className="text-xs font-black uppercase text-[#536271]">
              Organisation
            </p>
            <p className="mt-1 text-sm font-black text-[#06324A]">
              {organisationName}
            </p>

            <p className="mt-3 text-xs font-black uppercase text-[#536271]">
              Project
            </p>
            <p className="mt-1 text-sm font-black text-[#06324A]">
              {projectName}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-[#536271]">
                {organisationRole ?? "no role"}
              </span>
              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-[#536271]">
                {projectRole ?? "no project role"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 w-full rounded-full border border-[#C9D8E4] bg-white px-4 py-2 text-sm font-black text-[#06324A] transition hover:border-[#0A5278] hover:bg-[#0A5278] hover:text-white"
            >
              Logout
            </button>
          </div>

          <nav className="mt-5 space-y-5">
            {visibleNavigation.map((group) => (
              <div key={group.title}>
                <p className="px-2 text-[11px] font-black uppercase tracking-[0.15em] text-[#536271]">
                  {group.title}
                </p>

                <div className="mt-2 space-y-1">
                  {group.items.map((item) => {
                    const active =
                      pathname === item.href ||
                      (item.href !== "/" && pathname.startsWith(item.href));

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={[
                          "block rounded-xl px-3 py-2 text-sm font-black transition",
                          active
                            ? "bg-[#0A5278] text-white shadow-sm"
                            : "text-[#06324A] hover:bg-[#EAF2F8] hover:text-[#0A5278]",
                        ].join(" ")}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span>{item.title}</span>
                          {item.tag ? (
                            <span
                              className={[
                                "rounded-full px-2 py-0.5 text-[10px] font-black",
                                active
                                  ? "bg-white/20 text-white"
                                  : "bg-[#EAF2F8] text-[#0A5278]",
                              ].join(" ")}
                            >
                              {item.tag}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-[#C9D8E4] bg-white/95 px-4 py-3 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0A5278]">
                  {organisationName}
                </p>
                <h2 className="text-base font-black text-[#06324A]">
                  {projectName}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#C9D8E4] bg-[#EAF2F8] px-3 py-1 text-xs font-black text-[#06324A]">
                  Organisation: {organisationRole ?? "none"}
                </span>
                <span className="rounded-full border border-[#C9D8E4] bg-[#EAF2F8] px-3 py-1 text-xs font-black text-[#06324A]">
                  Project: {projectRole ?? "none"}
                </span>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-[#C9D8E4] bg-white px-3 py-1 text-xs font-black text-[#06324A] transition hover:border-[#0A5278] hover:bg-[#0A5278] hover:text-white"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}