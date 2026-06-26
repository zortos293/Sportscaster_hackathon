import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { Metadata } from "next";
import { AppAuthProvider } from "@/components/AppAuthProvider";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { isConvexAuthEnabled } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sportcast — AI commentary for every game",
  description:
    "Discover niche sports with AI-powered commentary and insights. Live streaming for emerging sports.",
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
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="isolate flex min-h-dvh flex-col bg-background font-sans text-on-background">
        {isConvexAuthEnabled() ? (
          <ConvexAuthNextjsServerProvider>{app}</ConvexAuthNextjsServerProvider>
        ) : (
          app
        )}
      </body>
    </html>
  );
}
