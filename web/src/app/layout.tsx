import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { Metadata } from "next";
import { AppAuthProvider } from "@/components/AppAuthProvider";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { isConvexEnabled } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sportscaster — AI commentary for every game",
  description:
    "Live AI sportscaster commentary powered by ElevenLabs for sports that do not have native audio.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const app = (
    <ConvexClientProvider>
      <AppAuthProvider>{children}</AppAuthProvider>
    </ConvexClientProvider>
  );

  return (
    <html lang="en" className="h-full antialiased">
      <body className="isolate flex min-h-dvh flex-col bg-white font-sans text-neutral-950">
        {isConvexEnabled() ? (
          <ConvexAuthNextjsServerProvider>{app}</ConvexAuthNextjsServerProvider>
        ) : (
          app
        )}
      </body>
    </html>
  );
}
