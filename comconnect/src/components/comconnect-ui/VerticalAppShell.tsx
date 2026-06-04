"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

export function VerticalAppShell({
  children,
  organisationRole = "organisation_admin",
  projectRole = "project_manager",
  organisationName = "Current organisation",
  projectName = "Current project",
}: VerticalAppShellProps) {
  const pathname = usePathname();

  function can(permission: Permission) {
    return userCan({
      organisationRole,
      projectRole,
      permission,
    });
  }

  const visibleNavigation = sidebarNavigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => can(item.permission)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen bg-[#FFF7F2]">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-orange-100 bg-white px-4 py-5 shadow-sm lg:block">
          <Link href="/" className="block">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F26A21]">
              ComConnect
            </p>
            <h1 className="mt-1 text-xl font-black text-slate-950">
              Control Center
            </h1>
          </Link>

          <div className="mt-5 rounded-2xl bg-[#FFF7F2] p-3">
            <p className="text-xs font-black uppercase text-slate-500">
              Organisation
            </p>
            <p className="mt-1 text-sm font-black text-slate-900">
              {organisationName}
            </p>

            <p className="mt-3 text-xs font-black uppercase text-slate-500">
              Project
            </p>
            <p className="mt-1 text-sm font-black text-slate-900">
              {projectName}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-slate-600">
                {organisationRole}
              </span>
              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-slate-600">
                {projectRole}
              </span>
            </div>
          </div>

          <nav className="mt-5 space-y-5">
            {visibleNavigation.map((group) => (
              <div key={group.title}>
                <p className="px-2 text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
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
                            ? "bg-[#F26A21] text-white shadow-sm"
                            : "text-slate-700 hover:bg-[#FFF7F2] hover:text-slate-950",
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
                                  : "bg-orange-50 text-[#F26A21]",
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
          <header className="sticky top-0 z-20 border-b border-orange-100 bg-white/95 px-4 py-3 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F26A21]">
                  {organisationName}
                </p>
                <h2 className="text-base font-black text-slate-950">
                  {projectName}
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-orange-100 bg-[#FFF7F2] px-3 py-1 text-xs font-black text-slate-700">
                  Organisation: {organisationRole}
                </span>
                <span className="rounded-full border border-orange-100 bg-[#FFF7F2] px-3 py-1 text-xs font-black text-slate-700">
                  Project: {projectRole}
                </span>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}