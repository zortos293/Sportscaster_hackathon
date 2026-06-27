import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { isAdminEnabled } from "@/lib/env";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isAuthPage = createRouteMatcher(["/sign-in", "/sign-up"]);
const isAdminPage = createRouteMatcher(["/admin(.*)"]);
const isAdminApiRoute = createRouteMatcher(["/api/admin(.*)"]);

const convexAuthEnabled =
  process.env.NEXT_PUBLIC_DISABLE_CONVEX_AUTH !== "true" &&
  Boolean(
    process.env.NEXT_PUBLIC_CONVEX_URL?.trim() &&
      /^https?:\/\//.test(process.env.NEXT_PUBLIC_CONVEX_URL.trim()),
  );

function adminAccessGuard(request: NextRequest): NextResponse | null {
  if (isAdminEnabled()) return null;

  if (isAdminPage(request)) {
    return new NextResponse(null, { status: 404 });
  }

  if (isAdminApiRoute(request) && request.method !== "GET") {
    return new NextResponse(null, { status: 404 });
  }

  return null;
}

export default convexAuthEnabled
  ? convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
      const adminBlocked = adminAccessGuard(request);
      if (adminBlocked) return adminBlocked;

      if (isAuthPage(request) && (await convexAuth.isAuthenticated())) {
        return nextjsMiddlewareRedirect(request, "/live");
      }

      if (isAdminPage(request) && !(await convexAuth.isAuthenticated())) {
        return nextjsMiddlewareRedirect(request, "/sign-in");
      }
    })
  : (request: NextRequest) => adminAccessGuard(request) ?? NextResponse.next();

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
