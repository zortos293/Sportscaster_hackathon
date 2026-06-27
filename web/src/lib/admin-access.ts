import { isAdminEnabled } from "@/lib/env";

export function adminDisabledResponse(): Response {
  return Response.json({ error: "Not found" }, { status: 404 });
}

export function assertAdminEnabled(): Response | null {
  if (isAdminEnabled()) return null;
  return adminDisabledResponse();
}
