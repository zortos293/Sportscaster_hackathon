import Link from "next/link";

const links = [
  { href: "#", label: "Privacy Policy" },
  { href: "#", label: "Terms of Service" },
  { href: "#", label: "Help Center" },
  { href: "#", label: "Contact" },
];

export function SportcastFooter() {
  return (
    <footer className="flex w-full flex-col items-center justify-between gap-4 border-t border-surface-container-high bg-surface-container-low px-margin-mobile py-gutter md:flex-row md:px-margin-desktop">
      <span className="font-display text-headline-md font-bold text-on-surface">
        Sportcast
      </span>
      <div className="flex flex-wrap justify-center gap-6">
        {links.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="text-label-sm text-on-surface-variant transition-colors hover:text-primary"
          >
            {link.label}
          </Link>
        ))}
      </div>
      <p className="text-label-sm text-secondary">
        © 2026 Sportcast Streaming. All rights reserved.
      </p>
    </footer>
  );
}
