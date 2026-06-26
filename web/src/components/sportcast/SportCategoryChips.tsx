"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MaterialIcon } from "./MaterialIcon";

const VISIBLE_CHIPS = [
  { slug: "all", label: "All" },
  { slug: "teqball", label: "Teqball" },
  { slug: "dodgeball", label: "Dodgeball" },
  { slug: "padel", label: "Padel" },
  { slug: "spikeball", label: "Spikeball" },
  { slug: "bouldering", label: "Bouldering", desktopOnly: true },
];

const OVERFLOW_CHIPS = [
  { slug: "bouldering", label: "Bouldering", mobileOnly: true },
  { slug: "kitesurfing", label: "Kitesurfing" },
  { slug: "hobby-horsing", label: "Hobby Horsing" },
  { slug: "underwater-hockey", label: "Underwater Hockey" },
  { slug: "pickleball", label: "Pickleball" },
  { slug: "professional-fishing", label: "Professional Fishing" },
];

const OVERFLOW_SLUGS = new Set(OVERFLOW_CHIPS.map((c) => c.slug));

function readCategoriesOpen() {
  if (typeof window === "undefined") return false;
  return window.location.hash === "#categories";
}

type SportCategoryChipsProps = {
  variant?: "inline" | "panel";
};

export function SportCategoryChips({ variant = "panel" }: SportCategoryChipsProps) {
  const [active, setActive] = useState("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const syncPanelFromHash = useCallback(() => {
    setPanelOpen(readCategoriesOpen());
  }, []);

  useEffect(() => {
    syncPanelFromHash();
    window.addEventListener("hashchange", syncPanelFromHash);
    return () => window.removeEventListener("hashchange", syncPanelFromHash);
  }, [syncPanelFromHash]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        if (panelOpen && variant === "panel") {
          setPanelOpen(false);
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [panelOpen, variant]);

  function selectSport(slug: string) {
    setActive(slug);
    setMenuOpen(false);
  }

  const hasOverflowSelection = OVERFLOW_SLUGS.has(active) && active !== "all";

  const chips = (
    <div className="flex items-center gap-3">
      <div
        ref={scrollRef}
        id="sport-categories"
        className="hide-scrollbar flex min-w-0 flex-1 items-center gap-3 overflow-x-auto pb-1"
        onWheel={(event) => {
          event.preventDefault();
          if (scrollRef.current) {
            scrollRef.current.scrollLeft += event.deltaY;
          }
        }}
      >
        {VISIBLE_CHIPS.map((chip) => (
          <button
            key={chip.slug}
            type="button"
            onClick={() => selectSport(chip.slug)}
            className={`sport-chip ${chip.desktopOnly ? "hidden lg:inline-flex" : ""} ${active === chip.slug ? "active" : ""}`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div ref={wrapRef} className="relative z-50 shrink-0">
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-haspopup="true"
          aria-label="More sports"
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((open) => !open);
          }}
          className={`sport-more-btn ${menuOpen ? "is-open" : ""} ${hasOverflowSelection ? "has-selection" : ""}`}
        >
          More
          <MaterialIcon name="more_horiz" className="text-lg" />
        </button>
        <div className={`sport-more-menu ${menuOpen ? "open" : ""}`} role="menu">
          {OVERFLOW_CHIPS.map((chip) => (
            <button
              key={chip.slug}
              type="button"
              role="menuitem"
              onClick={() => selectSport(chip.slug)}
              className={`sport-chip ${chip.mobileOnly ? "lg:hidden" : ""} ${active === chip.slug ? "active" : ""}`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (variant === "inline") {
    return <section className="mb-10">{chips}</section>;
  }

  return (
    <div
      id="sport-categories-panel"
      className={`sport-categories-panel sticky top-20 z-40 bg-black ${panelOpen ? "is-open" : ""}`}
    >
      <div className="mx-auto max-w-(--spacing-container-max) px-margin-mobile py-4 md:px-margin-desktop">
        {chips}
      </div>
    </div>
  );
}
