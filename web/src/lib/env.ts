export function isConvexEnabled(): boolean {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  return Boolean(url && /^https?:\/\//.test(url));
}

export function isConvexAuthEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_DISABLE_CONVEX_AUTH === "true") {
    return false;
  }
  return isConvexEnabled();
}

export function getConvexUrl(): string {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_URL is missing. Run `npx convex dev` in web/ and paste the deployment URL into .env.local, or leave it empty for local demo mode (no auth).",
    );
  }
  return url;
}
