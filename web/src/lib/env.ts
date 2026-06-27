/** Admin UI and write APIs — off in production unless ADMIN_ENABLED=true. */
export function isAdminEnabled(): boolean {
  const flag = process.env.ADMIN_ENABLED?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env.NODE_ENV !== "production";
}

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
