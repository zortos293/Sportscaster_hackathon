import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-on-background">
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <Image
          src="/logo.png"
          alt="Sportcast"
          width={80}
          height={80}
          className="mb-6 h-20 w-20 object-contain"
        />
        <h1 className="font-display text-display-lg-mobile text-primary md:text-display-lg">
          Sportcast
        </h1>
        <p className="mx-auto mt-4 max-w-md text-body-lg text-on-surface-variant">
          AI-powered commentary and live streaming for niche and emerging sports.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/live"
            className="rounded-full bg-primary-container px-8 py-4 font-bold text-white shadow-lg transition-all hover:brightness-110 active:scale-95"
          >
            Go to Live
          </Link>
          <Link
            href="/onboarding"
            className="rounded-full border border-surface-container-high bg-surface px-8 py-4 font-bold text-on-surface transition-all hover:bg-surface-container-low active:scale-95"
          >
            Get started
          </Link>
        </div>
      </main>
    </div>
  );
}
