"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AuthFlow = "signIn" | "signUp";

type PasswordAuthFormProps = {
  flow: AuthFlow;
  title: string;
  description: string;
  alternateHref: string;
  alternateLabel: string;
};

export function PasswordAuthForm({
  flow,
  title,
  description,
  alternateHref,
  alternateLabel,
}: PasswordAuthFormProps) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signIn("password", { email, password, flow });
      router.push("/live");
      router.refresh();
    } catch {
      setError(
        flow === "signIn"
          ? "Invalid email or password. Please try again."
          : "Could not create your account. Check your details and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xs">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-neutral-950">
          {title}
        </h1>
        <p className="mt-3 max-w-[48ch] text-base/7 text-pretty text-neutral-600 sm:text-sm/6">
          {description}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <div>
          <label
            htmlFor="email"
            className="text-base/6 font-medium text-neutral-950 sm:text-sm/6"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-lg bg-white px-3 py-2.5 text-base/7 text-neutral-950 ring-1 ring-black/10 outline-hidden focus:-outline-offset-1 focus:outline-2 focus:outline-emerald-600 max-sm:text-base/7 sm:py-1.5 sm:text-sm/6"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="text-base/6 font-medium text-neutral-950 sm:text-sm/6"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={flow === "signIn" ? "current-password" : "new-password"}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-lg bg-white px-3 py-2.5 text-base/7 text-neutral-950 ring-1 ring-black/10 outline-hidden focus:-outline-offset-1 focus:outline-2 focus:outline-emerald-600 max-sm:text-base/7 sm:py-1.5 sm:text-sm/6"
          />
        </div>

        {error ? (
          <p className="text-base/7 text-red-600 sm:text-sm/6" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-emerald-600 px-3 py-2.5 text-base/7 font-medium text-white ring-1 ring-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-60 sm:py-1.5 sm:text-sm/6"
        >
          {isSubmitting
            ? "Please wait..."
            : flow === "signIn"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-base/7 text-neutral-600 sm:text-sm/6">
        {alternateLabel}{" "}
        <Link
          href={alternateHref}
          className="font-medium text-emerald-700 underline-offset-2 hover:underline"
        >
          {flow === "signIn" ? "Create an account" : "Sign in instead"}
        </Link>
      </p>
    </div>
  );
}
