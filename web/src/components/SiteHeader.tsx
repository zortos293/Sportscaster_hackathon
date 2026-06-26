"use client";

import { useAppAuth } from "@/components/AppAuthProvider";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const logoSrc =
  "https://assets.ui.sh/marks/1.svg?text=Sportscaster&color=emerald-600&textColor=neutral-950&font=inter";

function navLinkClass(isActive: boolean) {
  return isActive
    ? "rounded-md bg-neutral-950/5 px-3 py-2 text-base/6 text-neutral-950 sm:text-sm/6"
    : "rounded-md px-3 py-2 text-base/6 text-neutral-700 sm:text-sm/6";
}

export function SiteHeader() {
  const { isAuthenticated, isLoading, signOut } = useAppAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDashboard = pathname.startsWith("/dashboard");

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  const marketingLinks = (
    <>
      <Link href="/#features" className={navLinkClass(false)}>
        Features
      </Link>
      <Link href="/#how-it-works" className={navLinkClass(false)}>
        How it works
      </Link>
    </>
  );

  const authLinks = (
    <>
      {!isLoading && isAuthenticated ? (
        <>
          <Link
            href="/dashboard"
            className={navLinkClass(pathname.startsWith("/dashboard"))}
          >
            Dashboard
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-md px-3 py-2 text-base/6 text-neutral-700 sm:text-sm/6"
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <Link
            href="/sign-in"
            className={navLinkClass(pathname === "/sign-in")}
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-md bg-emerald-600 px-3 py-2 text-base/6 font-medium text-white ring-1 ring-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 sm:text-sm/6"
          >
            Get started
          </Link>
        </>
      )}
    </>
  );

  return (
    <header className="relative z-50 border-b border-neutral-950/10 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 lg:max-w-none lg:px-8">
        <Link href="/" aria-label="Homepage" className="shrink-0">
          <img src={logoSrc} alt="Sportscaster" className="h-6 w-auto" />
        </Link>

        <nav
          aria-label="Main"
          className="hidden items-center gap-x-1 lg:flex lg:gap-x-2"
        >
          {!isDashboard ? marketingLinks : null}
          {authLinks}
        </nav>

        <button
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="relative rounded-md p-2 text-neutral-700 lg:hidden"
        >
          <span className="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden" aria-hidden="true" />
          <span className="sr-only">
            {mobileMenuOpen ? "Close menu" : "Open menu"}
          </span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="size-6 shrink-0"
          >
            {mobileMenuOpen ? (
              <path
                d="M6 6l12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {mobileMenuOpen ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-neutral-950/20 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <nav
            id="mobile-nav"
            aria-label="Mobile"
            className="absolute inset-x-0 top-full z-50 border-b border-neutral-950/10 bg-white px-6 py-4 lg:hidden"
          >
            <div className="flex flex-col gap-1">
              {!isDashboard ? (
                <>
                  <Link href="/#features" className={navLinkClass(false)}>
                    Features
                  </Link>
                  <Link href="/#how-it-works" className={navLinkClass(false)}>
                    How it works
                  </Link>
                </>
              ) : null}
              {!isLoading && isAuthenticated ? (
                <>
                  <Link
                    href="/dashboard"
                    className={navLinkClass(pathname.startsWith("/dashboard"))}
                  >
                    Dashboard
                  </Link>
                  <Link href="/" className={navLinkClass(false)}>
                    Home
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="rounded-md px-3 py-2 text-left text-base/6 text-neutral-700"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/sign-in" className={navLinkClass(false)}>
                    Sign in
                  </Link>
                  <Link
                    href="/sign-up"
                    className="rounded-md bg-emerald-600 px-3 py-2 text-base/6 font-medium text-white ring-1 ring-emerald-600"
                  >
                    Get started
                  </Link>
                </>
              )}
            </div>
          </nav>
        </>
      ) : null}
    </header>
  );
}
