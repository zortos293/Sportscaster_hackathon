"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const sidebarLinks = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/watch/georgia-ole-miss", label: "College football" },
  { href: "/dashboard/watch/chelsea-newcastle", label: "Premier League" },
];

function navItemClass(isActive: boolean) {
  return isActive
    ? "rounded-lg bg-neutral-950/5 px-3 py-2 text-base/6 text-neutral-950 sm:text-sm/6"
    : "rounded-lg px-3 py-2 text-base/6 text-neutral-700 sm:text-sm/6";
}

function isLinkActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname.startsWith(href);
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="hidden w-56 shrink-0 border-r border-neutral-950/10 bg-white lg:flex lg:flex-col lg:px-4 lg:py-8">
        <p className="px-3 font-mono text-base/6 text-emerald-700 sm:text-sm/6">
          Your booth
        </p>
        <nav aria-label="Dashboard" className="mt-4 flex flex-col gap-1">
          {sidebarLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={navItemClass(isLinkActive(pathname, link.href))}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      <nav
        aria-label="Dashboard sections"
        className="border-b border-neutral-950/10 bg-white lg:hidden"
      >
        <div className="flex gap-1 overflow-x-auto px-6 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sidebarLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 ${navItemClass(isLinkActive(pathname, link.href))}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
