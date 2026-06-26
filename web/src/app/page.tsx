import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const features = [
  {
    title: "Commentary where there is none",
    description:
      "College lacrosse, rugby, minor leagues, and niche streams often ship without a broadcast booth. Sportscaster fills the silence with play-by-play that follows the action.",
  },
  {
    title: "ElevenLabs voice quality",
    description:
      "Natural, expressive speech from ElevenLabs keeps the broadcast feeling human — not robotic text-to-speech — so fans stay immersed in the game.",
  },
  {
    title: "Live stats, real reactions",
    description:
      "ESPN scoreboard data drives commentary that reacts to score changes, period shifts, and momentum swings as the game unfolds.",
  },
  {
    title: "Watch with or without video",
    description:
      "Pair AI audio with YouTube replays, Twitch streams, or a simple scoreboard view. Mute the original feed and listen to your AI booth instead.",
  },
];

const steps = [
  {
    title: "Pick a game",
    description:
      "Choose a sport and event — basketball, lacrosse, rugby, and more — from leagues covered by live stats feeds.",
  },
  {
    title: "Generate the broadcast",
    description:
      "Our engine watches stat updates, writes broadcaster-style lines, and sends them to ElevenLabs for instant speech.",
  },
  {
    title: "Listen live",
    description:
      "Stream AI commentary over your video or follow along audio-only. Every big moment gets a voice.",
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        <section className="border-b border-neutral-950/10 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-mono text-base/6 text-emerald-700 sm:text-sm/6">
                AI sportscasting for underserved sports
              </p>
              <h1 className="mx-auto mt-4 max-w-[24ch] text-5xl font-semibold tracking-tight text-balance text-neutral-950 sm:text-6xl">
                Every game deserves a broadcast booth
              </h1>
              <p className="mx-auto mt-6 max-w-[48ch] text-lg/8 text-pretty text-neutral-600">
                Sportscaster generates live play-by-play commentary with
                ElevenLabs voices for sports that do not have native audio —
                so fans can hear the game, not just watch it.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/dashboard"
                  className="rounded-lg bg-emerald-600 px-4 py-3 text-base/7 font-medium text-white ring-1 ring-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 sm:py-2 sm:text-sm/6"
                >
                  Start listening
                </Link>
                <Link
                  href="#how-it-works"
                  className="rounded-lg px-4 py-3 text-base/7 font-medium text-emerald-700 sm:py-2 sm:text-sm/6"
                >
                  See how it works
                </Link>
              </div>
            </div>

            <div className="mx-auto mt-16 max-w-5xl overflow-hidden rounded-[min(1vw,12px)] ring-1 ring-black/10">
              <img
                src="https://assets.ui.sh/screenshots/1.webp?top=900&left=1200&position=bottom-right"
                alt="Sportscaster dashboard preview"
                className="w-full"
              />
            </div>
          </div>
        </section>

        <section id="features" className="py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <p className="font-mono text-base/6 text-emerald-700 sm:text-sm/6">
              Built for fans left behind
            </p>
            <h2 className="mt-4 max-w-[35ch] text-4xl font-semibold tracking-tight text-balance text-neutral-950">
              Commentary for sports without a voice
            </h2>
            <p className="mt-6 max-w-[48ch] text-lg/8 text-pretty text-neutral-600">
              Most broadcast rights go to major leagues. Sportscaster gives every
              niche sport a professional-sounding booth powered by AI and
              ElevenLabs.
            </p>

            <dl className="mt-16 grid gap-10 sm:grid-cols-2 sm:gap-12">
              {features.map((feature) => (
                <div key={feature.title}>
                  <dt className="text-xl/8 font-semibold text-neutral-950 sm:text-lg/8">
                    {feature.title}
                  </dt>
                  <dd className="mt-3 text-base/7 text-pretty text-neutral-600 sm:text-sm/6">
                    {feature.description}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section
          id="how-it-works"
          className="border-y border-neutral-950/10 bg-neutral-950/[0.02] py-20 sm:py-28"
        >
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <p className="font-mono text-base/6 text-emerald-700 sm:text-sm/6">
              From stats to speech
            </p>
            <h2 className="mt-4 max-w-[35ch] text-4xl font-semibold tracking-tight text-balance text-neutral-950">
              How Sportscaster works
            </h2>
            <p className="mt-6 max-w-[48ch] text-lg/8 text-pretty text-neutral-600">
              Live data in, broadcaster-style audio out — in seconds.
            </p>

            <ol className="mt-16 grid gap-10 sm:grid-cols-3 sm:gap-12" role="list">
              {steps.map((step, index) => (
                <li key={step.title}>
                  <p className="font-mono text-base/6 tabular-nums text-emerald-700 sm:text-sm/6">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-3 text-xl/8 font-semibold text-neutral-950 sm:text-lg/8">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-base/7 text-pretty text-neutral-600 sm:text-sm/6">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-6 text-center lg:px-8">
            <h2 className="mx-auto max-w-[30ch] text-4xl font-semibold tracking-tight text-balance text-neutral-950">
              Hear the game you have been missing
            </h2>
            <p className="mx-auto mt-6 max-w-[48ch] text-lg/8 text-pretty text-neutral-600">
              Create an account and bring AI commentary to your next watch
              party, club stream, or replay session.
            </p>
            <div className="mt-10">
              <Link
                href="/sign-up"
                className="inline-flex rounded-lg px-4 py-3 text-base/7 font-medium text-emerald-700 ring-1 ring-black/10 sm:py-2 sm:text-sm/6"
              >
                Get started free
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
