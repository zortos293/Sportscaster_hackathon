"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";
import { getConvexUrl, isConvexAuthEnabled, isConvexEnabled } from "@/lib/env";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convex = useMemo(
    () => (isConvexEnabled() ? new ConvexReactClient(getConvexUrl()) : null),
    [],
  );

  if (!convex) {
    return <>{children}</>;
  }

  if (isConvexAuthEnabled()) {
    return (
      <ConvexAuthNextjsProvider client={convex}>{children}</ConvexAuthNextjsProvider>
    );
  }

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
