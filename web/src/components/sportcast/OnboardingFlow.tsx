"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { isConvexEnabled } from "@/lib/env";
import { LANGUAGES, ONBOARDING_SPORTS } from "@/lib/sportcast/matches";
import { MaterialIcon } from "./MaterialIcon";

export function OnboardingFlow() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedSports, setSelectedSports] = useState<Set<string>>(new Set());
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const progress = (step / 3) * 100;

  function toggleSport(label: string) {
    setSelectedSports((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  async function handleCreateAccount() {
    setError(null);
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (isConvexEnabled()) {
      setIsSubmitting(true);
      try {
        await signIn("password", { email, password, flow: "signUp" });
      } catch {
        setError("Could not create your account. Check your details and try again.");
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
    }
    setStep(2);
  }

  async function finishOnboarding() {
    if (isConvexEnabled() && email && password) {
      setIsSubmitting(true);
      try {
        await signIn("password", { email, password, flow: "signUp" });
      } catch {
        // Account may already exist from step 1
      }
      setIsSubmitting(false);
    }
    setFinished(true);
  }

  if (finished) {
    return (
      <div className="flex min-h-[640px] flex-col items-center justify-center px-8 py-12 text-center">
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-primary-container text-white shadow-xl">
          <MaterialIcon name="check" filled className="text-[48px]" />
        </div>
        <h2 className="font-display text-display-lg-mobile md:text-display-lg">
          You&apos;re all set, {name || "Champ"}!
        </h2>
        <p className="mx-auto mt-4 mb-10 max-w-md text-body-lg text-on-surface-variant">
          We&apos;ve tailored your dashboard with the sports and commentary you love.
          Get ready for a game-changing experience.
        </p>
        <Link
          href="/live"
          className="inline-block rounded-full bg-primary-container px-12 py-5 font-extrabold text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
        >
          Go to the Live
        </Link>
      </div>
    );
  }

  return (
    <>
      <header className="fixed top-0 left-0 z-50 w-full bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-(--spacing-container-max) flex-col justify-center px-margin-mobile md:px-margin-desktop">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" aria-hidden />
              <span className="font-display text-[24px] font-extrabold text-primary">Sportcast</span>
            </div>
            <span className="text-label-sm text-secondary uppercase">Step {step} of 3</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-surface-container-highest">
            <div className="progress-bar h-full bg-primary-container" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>

      <main className="flex flex-grow items-center justify-center px-4 pt-24 pb-12 md:px-8">
        <div className="mx-auto min-h-[640px] w-full max-w-5xl overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
          {step === 1 ? (
            <section className="step-transition flex min-h-[640px] w-full flex-col md:flex-row">
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center md:items-start md:p-16 md:text-left">
                <div className="w-full max-w-md">
                  <h1 className="font-display text-display-lg-mobile md:text-display-lg">
                    Welcome to Sportcast
                  </h1>
                  <p className="mt-4 mb-10 text-body-lg text-on-surface-variant">
                    Discover niche sports with AI-powered commentary and insights.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name-input" className="mb-2 block font-label-md text-on-surface">
                        Name
                      </label>
                      <input
                        id="name-input"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full rounded-lg border-transparent bg-surface-container p-4 text-body-md outline-none transition-all focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
                      />
                    </div>
                    <div>
                      <label htmlFor="email-input" className="mb-2 block font-label-md text-on-surface">
                        Email
                      </label>
                      <input
                        id="email-input"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="w-full rounded-lg border-transparent bg-surface-container p-4 text-body-md outline-none transition-all focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
                      />
                    </div>
                    <div>
                      <label htmlFor="password-input" className="mb-2 block font-label-md text-on-surface">
                        Password
                      </label>
                      <input
                        id="password-input"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a password"
                        minLength={8}
                        className="w-full rounded-lg border-transparent bg-surface-container p-4 text-body-md outline-none transition-all focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
                      />
                    </div>
                  </div>
                  {error ? (
                    <p className="mt-4 text-sm text-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleCreateAccount}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary-container px-10 py-4 font-bold text-white shadow-lg transition-all hover:brightness-110 active:scale-95 disabled:opacity-60 md:w-auto"
                  >
                    {isSubmitting ? "Creating account…" : "Create account"}
                    <MaterialIcon name="arrow_forward" />
                  </button>
                </div>
              </div>
              <div className="relative hidden flex-1 flex-col items-center justify-between gap-6 overflow-hidden bg-surface-container-low p-12 md:flex">
                <div className="w-full max-w-md rotate-2 transform overflow-hidden rounded-2xl border border-surface-container-highest bg-surface shadow-2xl">
                  <div className="flex items-center justify-between border-b border-surface-container bg-surface-container-lowest p-4">
                    <div className="flex gap-2">
                      <div className="h-3 w-3 rounded-full bg-error/20" />
                      <div className="h-3 w-3 rounded-full bg-primary-container/20" />
                      <div className="h-3 w-3 rounded-full bg-surface-variant" />
                    </div>
                    <div className="text-label-sm text-secondary">Dashboard Preview</div>
                  </div>
                  <div className="space-y-6 p-6">
                    <div className="h-8 w-1/2 rounded-lg bg-surface-container" />
                    <div className="overflow-hidden rounded-xl border border-surface-container-highest shadow-sm">
                      <Image
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDCYRgsN0kC3g4CYFPvG-W2bT0FjeS9ob7DowY9oHj9wYgWgsBpn9QkkUoYnYM7rPm7odFiZh8cOxEckeejQjIv6CHAgLmqxnENTWNkDeB9wehxPEvbTCTwOLan4qyBWEvwEtZz5b-BCxVIC7H6yjlcl-_D6aTi43hBONx-M6-exToGyRL97VsVvX1vijx0WUUm88WfI2o0breiMd5sd_Ra5YEX0L9Y7r2WQ6VmE_-pK7OwkPM5h72JFkqidqovuhgiAIsjRy1VmLLg"
                        alt="Featured Match"
                        width={400}
                        height={128}
                        className="h-32 w-full object-cover"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl border border-primary-container/10 bg-primary-container/5 p-4">
                        <MaterialIcon name="play_circle" filled className="text-[32px] text-primary" />
                        <div className="text-label-sm text-secondary">Highlight reels</div>
                      </div>
                      <div className="rounded-xl bg-surface-container-low p-4">
                        <div className="mb-1 text-xl font-bold text-on-surface">1.8M</div>
                        <div className="text-label-sm text-secondary">Live Viewers</div>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="z-10 mx-auto max-w-xs text-center text-body-md text-on-surface-variant italic">
                  &ldquo;The world&apos;s premium second-tier/ emerging streaming platform. Fast,
                  reliable, and immersive live action.&rdquo;
                </p>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="flex min-h-[640px] w-full flex-col justify-center p-8 md:p-16">
              <div className="mx-auto w-full max-w-4xl">
                <div className="mb-10 text-center">
                  <h2 className="font-display text-headline-lg-mobile md:text-headline-lg">
                    What sports are you interested in?
                  </h2>
                  <p className="text-body-md text-on-surface-variant">
                    Select all that apply to personalize your feed.
                  </p>
                </div>
                <div className="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
                  {ONBOARDING_SPORTS.map((sport) => {
                    const active = selectedSports.has(sport.label);
                    return (
                      <button
                        key={sport.label}
                        type="button"
                        onClick={() => toggleSport(sport.label)}
                        className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 p-6 transition-all ${active ? "sport-card-active border-primary-container" : "border-surface-container bg-surface-container-low hover:border-outline-variant"}`}
                      >
                        <MaterialIcon
                          name={sport.icon}
                          filled={active}
                          className={`mb-3 text-[32px] transition-colors ${active ? "text-primary" : "text-secondary group-hover:text-primary"}`}
                        />
                        <span className="font-label-md">{sport.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-2 font-bold text-secondary transition-colors hover:text-on-surface"
                  >
                    <MaterialIcon name="arrow_back" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="rounded-full bg-primary-container px-10 py-4 font-bold text-white shadow-lg transition-all hover:brightness-110 active:scale-95"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="flex min-h-[640px] w-full flex-col justify-center p-8 md:p-16">
              <div className="mx-auto w-full max-w-4xl">
                <div className="mb-10 text-center">
                  <h2 className="font-display text-headline-lg-mobile md:text-headline-lg">
                    Choose your language
                  </h2>
                  <p className="text-body-md text-on-surface-variant">
                    We&apos;ll use this for your AI-generated commentary and match insights.
                  </p>
                </div>
                <div className="mx-auto mb-12 max-w-md space-y-3">
                  {LANGUAGES.map((lang) => {
                    const active = selectedLanguage === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setSelectedLanguage(lang.code)}
                        className={`group flex w-full cursor-pointer items-center justify-between rounded-xl border-2 p-4 transition-all ${active ? "sport-card-active border-primary-container" : "border-surface-container bg-surface-container-low hover:border-outline-variant"}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-xl">
                            {lang.flag}
                          </div>
                          <span className="text-body-md font-semibold">{lang.label}</span>
                        </div>
                        <MaterialIcon
                          name="check_circle"
                          className={`text-primary-container transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex items-center gap-2 font-bold text-secondary transition-colors hover:text-on-surface"
                  >
                    <MaterialIcon name="arrow_back" />
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={finishOnboarding}
                    className="rounded-full bg-primary-container px-10 py-4 font-bold text-white shadow-lg transition-all hover:brightness-110 active:scale-95 disabled:opacity-60"
                  >
                    {isSubmitting ? "Finishing…" : "Finish"}
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </main>

      <SportcastOnboardingFooter />
    </>
  );
}

function SportcastOnboardingFooter() {
  return (
    <footer className="flex w-full flex-col items-center justify-between gap-4 border-t border-surface-container-high bg-surface-container-low px-margin-mobile py-gutter md:flex-row md:px-margin-desktop">
      <span className="font-display text-headline-md font-bold text-on-surface">Sportcast</span>
      <div className="flex flex-wrap justify-center gap-6">
        {["Privacy Policy", "Terms of Service", "Help Center", "Contact"].map((label) => (
          <Link key={label} href="#" className="text-label-sm text-on-surface-variant transition-colors hover:text-primary">
            {label}
          </Link>
        ))}
      </div>
      <p className="text-label-sm text-secondary">© 2026 Sportcast Streaming. All rights reserved.</p>
    </footer>
  );
}
