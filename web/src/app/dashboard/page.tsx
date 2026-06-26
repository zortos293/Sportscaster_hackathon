"use client";

import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const stats = [
  { label: "Active sessions", value: "0" },
  { label: "Commentary lines", value: "0" },
  { label: "Games watched", value: "0" },
];

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  if (isLoading) {
    return (
      <>
        <SiteHeader />
        <DashboardShell>
          <div className="px-6 py-12 lg:px-8">
            <p className="text-base/7 text-neutral-600 sm:text-sm/6">
              Loading your account...
            </p>
          </div>
        </DashboardShell>
        <SiteFooter />
      </>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <SiteHeader />

      <DashboardShell>
        <div className="px-6 py-8 sm:py-10 lg:px-8 lg:py-12">
          <div className="max-w-3xl">
            <h1 className="max-w-[35ch] text-3xl font-semibold tracking-tight text-balance text-neutral-950 sm:text-4xl">
              Dashboard
            </h1>
            <p className="mt-4 max-w-[48ch] text-base/7 text-pretty text-neutral-600 sm:text-sm/6">
              You are signed in and ready to start a Sportscaster session.
              Connect a game, mute the original feed, and listen to
              ElevenLabs-powered commentary.
            </p>
          </div>

          <div className="@container mt-10">
            <dl className="grid grid-cols-1 divide-y divide-neutral-950/10 rounded-xl ring-1 ring-black/10 @md:grid-cols-3 @md:divide-x @md:divide-y-0">
              {stats.map((stat) => (
                <div key={stat.label} className="px-5 py-5 @md:py-6">
                  <dt className="truncate text-base/6 text-neutral-600 sm:text-sm/6">
                    {stat.label}
                  </dt>
                  <dd className="mt-2 text-3xl font-semibold tabular-nums text-neutral-950 sm:text-2xl">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              disabled
              className="w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-base/7 font-medium text-white ring-1 ring-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-60 sm:w-auto sm:py-2 sm:text-sm/6"
            >
              Start new session
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full rounded-lg px-3 py-2.5 text-base/7 font-medium text-neutral-700 ring-1 ring-black/10 sm:w-auto sm:py-2 sm:text-sm/6"
            >
              Sign out
            </button>
            <Link
              href="/"
              className="w-full rounded-lg px-3 py-2.5 text-center text-base/7 font-medium text-emerald-700 sm:w-auto sm:py-2 sm:text-sm/6"
            >
              Back to home
            </Link>
          </div>

          <div className="mt-10 rounded-xl p-5 ring-1 ring-black/10 sm:p-6">
            <h2 className="text-xl/8 font-semibold text-neutral-950 sm:text-lg/8">
              Coming next
            </h2>
            <p className="mt-3 max-w-[48ch] text-base/7 text-pretty text-neutral-600 sm:text-sm/6">
              Session creation and live commentary will connect to the FastAPI
              backend in a future update. For now, your account is secured with
              Convex password auth.
            </p>
          </div>
        </div>
      </DashboardShell>

      <SiteFooter />
    </>
  );
}
