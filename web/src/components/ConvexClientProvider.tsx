"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";
import { getConvexUrl, isConvexEnabled } from "@/lib/env";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convex = useMemo(
    () => (isConvexEnabled() ? new ConvexReactClient(getConvexUrl()) : null),
    [],
  );

  if (!convex) {
    return <>{children}</>;
  }

  return (
    <ConvexAuthNextjsProvider client={convex}>{children}</ConvexAuthNextjsProvider>
  );
}
