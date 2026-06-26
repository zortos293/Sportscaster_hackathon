import Link from "next/link";

const logoSrc =
  "https://assets.ui.sh/marks/1.svg?text=Sportscaster&color=emerald-600&textColor=neutral-950&font=inter";

export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-950/10 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" aria-label="Homepage" className="shrink-0">
            <img src={logoSrc} alt="Sportscaster" className="h-6 w-auto" />
          </Link>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link
              href="/#features"
              className="font-normal text-base/6 text-neutral-600 sm:text-sm/6"
            >
              Features
            </Link>
            <Link
              href="/sign-in"
              className="font-normal text-base/6 text-neutral-600 sm:text-sm/6"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="font-normal text-base/6 text-neutral-600 sm:text-sm/6"
            >
              Create account
            </Link>
          </nav>
        </div>
        <p className="text-base/6 text-neutral-500 sm:text-sm/6">
          AI commentary for sports that deserve a voice.
        </p>
      </div>
    </footer>
  );
}
