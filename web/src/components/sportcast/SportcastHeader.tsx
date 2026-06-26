"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AVATAR_URL } from "@/lib/sportcast/matches";
import { MaterialIcon } from "./MaterialIcon";

type NavItem = "live" | "highlight";

type SportcastHeaderProps = {
  activeNav?: NavItem;
  dark?: boolean;
  showCategories?: boolean;
};

function readCategoriesOpen() {
  if (typeof window === "undefined") return false;
  return window.location.hash === "#categories";
}

export function SportcastHeader({
  activeNav,
  dark = false,
  showCategories = false,
}: SportcastHeaderProps) {
  const pathname = usePathname();
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const liveActive =
    activeNav === "live" ||
    pathname.startsWith("/live") ||
    pathname.startsWith("/matches") ||
    pathname.startsWith("/commentary");
  const highlightActive = activeNav === "highlight" || pathname.startsWith("/highlight");

  const syncCategoriesFromHash = useCallback(() => {
    setCategoriesOpen(readCategoriesOpen());
  }, []);

  useEffect(() => {
    syncCategoriesFromHash();
    window.addEventListener("hashchange", syncCategoriesFromHash);
    return () => window.removeEventListener("hashchange", syncCategoriesFromHash);
  }, [syncCategoriesFromHash]);

  function toggleCategories() {
    const willOpen = !categoriesOpen;
    setCategoriesOpen(willOpen);
    if (willOpen) {
      window.history.replaceState(null, "", `${pathname}#categories`);
    } else {
      window.history.replaceState(null, "", pathname);
    }
  }

  function closeCategories() {
    setCategoriesOpen(false);
    window.history.replaceState(null, "", pathname);
  }

  const isDark = dark || showCategories;

  return (
    <header
      className={`sticky top-0 z-50 flex h-20 items-center ${
        isDark ? "bg-black text-white" : "bg-surface shadow-sm"
      }`}
    >
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
          <span
            className={`font-display text-headline-md font-extrabold md:text-display-lg ${
              isDark ? "text-white" : "text-primary"
            }`}
          >
            Sportcast
          </span>
        </Link>

        <div className="flex items-center gap-4 md:gap-8">
          {isDark ? (
            <>
              <Link
                href="/live"
                onClick={(event) => {
                  if (categoriesOpen && pathname === "/live") {
                    event.preventDefault();
                    closeCategories();
                  }
                }}
                className={`nav-link ${liveActive && !categoriesOpen ? "is-active" : ""}`}
              >
                Live
              </Link>
              <Link
                href="/highlight"
                className={`nav-link ${highlightActive ? "is-active" : ""}`}
              >
                Highlight
              </Link>
              {showCategories ? (
                <button
                  type="button"
                  aria-expanded={categoriesOpen}
                  aria-controls="sport-categories-panel"
                  onClick={toggleCategories}
                  className={`nav-link ${categoriesOpen ? "is-active" : ""}`}
                >
                  Categories
                </button>
              ) : (
                <Link href="/live#categories" className="nav-link">
                  Categories
                </Link>
              )}
            </>
          ) : (
            <>
              <Link
                href="/live"
                className={
                  liveActive
                    ? "border-b-2 border-primary px-1 py-1 font-bold text-primary transition-colors"
                    : "font-label-md text-secondary transition-colors hover:text-primary"
                }
              >
                Live
              </Link>
              <Link
                href="/highlight"
                className={
                  highlightActive
                    ? "border-b-2 border-primary px-1 py-1 font-bold text-primary transition-colors"
                    : "font-label-md text-secondary transition-colors hover:text-primary"
                }
              >
                Highlight
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <div className="relative hidden sm:block">
            <MaterialIcon
              name="search"
              className={`pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 ${
                isDark ? "text-white/40" : "text-secondary"
              }`}
            />
            <input
              aria-label="Search matches"
              type="search"
              placeholder={isDark ? "Search matches..." : "Search highlights..."}
              className={`w-48 rounded-full border-none py-2 pr-4 pl-10 text-body-md outline-none transition-all focus:ring-2 focus:ring-primary md:w-64 ${
                isDark
                  ? "bg-white/10 text-white placeholder:text-white/40"
                  : "bg-surface-container-low text-on-surface"
              }`}
            />
          </div>
          <button
            type="button"
            className={`cursor-pointer rounded-full p-2 transition-colors active:scale-95 ${
              isDark ? "text-white/70 hover:bg-white/10" : "text-secondary hover:bg-surface-container"
            }`}
          >
            <MaterialIcon name="notifications" />
          </button>
          <div
            className={`h-10 w-10 cursor-pointer overflow-hidden rounded-full border-2 transition-transform active:scale-95 ${
              isDark ? "border-primary" : "border-primary-container"
            }`}
          >
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
