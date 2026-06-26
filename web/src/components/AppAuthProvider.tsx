"use client";

import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { createContext, ReactNode, useContext } from "react";
import { isConvexAuthEnabled } from "@/lib/env";

type AppAuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const demoAuth: AppAuthState = {
  isAuthenticated: true,
  isLoading: false,
  signOut: async () => {},
};

const AuthContext = createContext<AppAuthState | null>(null);

function ConvexAuthBridge({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AppAuthProvider({ children }: { children: ReactNode }) {
  if (!isConvexAuthEnabled()) {
    return (
      <AuthContext.Provider value={demoAuth}>{children}</AuthContext.Provider>
    );
  }

  return <ConvexAuthBridge>{children}</ConvexAuthBridge>;
}

export function useAppAuth(): AppAuthState {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error("useAppAuth must be used within AppAuthProvider");
  }
  return auth;
}
