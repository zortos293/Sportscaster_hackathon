"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AVATAR_URL } from "@/lib/sportcast/matches";
import { MaterialIcon } from "./MaterialIcon";

type NavItem = "live" | "highlight";

export function SportcastHeader({ activeNav, dark = false }: { activeNav?: NavItem; dark?: boolean }) {
  const pathname = usePathname();
  const liveActive =
    activeNav === "live" ||
    pathname.startsWith("/live") ||
    pathname.startsWith("/matches") ||
    pathname.startsWith("/commentary");
  const highlightActive = activeNav === "highlight" || pathname.startsWith("/highlight");

  return (
    <header className={`sticky top-0 z-50 flex h-20 items-center ${dark ? "bg-[#0d0d0f] border-b border-white/10" : "bg-surface shadow-sm"}`}>
      <nav className="mx-auto flex w-full max-w-(--spacing-container-max) items-center justify-between px-margin-mobile md:px-margin-desktop">
        <Link
          href="/live"
          aria-label="Sportcast home"
          className="flex cursor-pointer items-center gap-3 transition-transform active:scale-95"
        >
          <Image
            src="/logo.png"
            alt=""
            width={56}
            height={56}
            className="h-12 w-12 shrink-0 object-contain md:h-14 md:w-14"
            aria-hidden
          />
          <span className={`font-display text-headline-md font-extrabold md:text-display-lg ${dark ? "text-white" : "text-primary"}`}>
            Sportcast
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="/live"
            className={
              liveActive
                ? `border-b-2 border-primary px-1 py-1 font-bold text-primary transition-colors`
                : `font-label-md transition-colors hover:text-primary ${dark ? "text-white/60" : "text-secondary"}`
            }
          >
            Live
          </Link>
          <Link
            href="/highlight"
            className={
              highlightActive
                ? "border-b-2 border-primary px-1 py-1 font-bold text-primary transition-colors"
                : `font-label-md transition-colors hover:text-primary ${dark ? "text-white/60" : "text-secondary"}`
            }
          >
            Highlight
          </Link>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <div className="relative hidden sm:block">
            <MaterialIcon
              name="search"
              className={`pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 ${dark ? "text-white/40" : "text-secondary"}`}
            />
            <input
              aria-label="Search highlights"
              type="search"
              placeholder="Search highlights..."
              className={`w-48 rounded-full border-none py-2 pr-4 pl-10 text-body-md outline-none transition-all focus:ring-2 focus:ring-primary md:w-64 ${
                dark
                  ? "bg-white/10 text-white placeholder:text-white/40"
                  : "bg-surface-container-low text-on-surface"
              }`}
            />
          </div>
          <button
            type="button"
            className={`cursor-pointer rounded-full p-2 transition-colors active:scale-95 ${dark ? "hover:bg-white/10 text-white/70" : "hover:bg-surface-container text-secondary"}`}
          >
            <MaterialIcon name="notifications" />
          </button>
          <div className="h-10 w-10 cursor-pointer overflow-hidden rounded-full border-2 border-primary-container transition-transform active:scale-95">
            <Image
              src={AVATAR_URL}
              alt="Profile"
              width={40}
              height={40}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </nav>
    </header>
  );
}
