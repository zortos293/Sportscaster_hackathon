import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isAuthPage = createRouteMatcher(["/sign-in", "/sign-up"]);
const isProtectedRoute = createRouteMatcher(["/admin(.*)"]);

const convexAuthEnabled =
  process.env.NEXT_PUBLIC_DISABLE_CONVEX_AUTH !== "true" &&
  Boolean(
    process.env.NEXT_PUBLIC_CONVEX_URL?.trim() &&
      /^https?:\/\//.test(process.env.NEXT_PUBLIC_CONVEX_URL.trim()),
  );

export default convexAuthEnabled
  ? convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
      if (isAuthPage(request) && (await convexAuth.isAuthenticated())) {
        return nextjsMiddlewareRedirect(request, "/live");
      }

      if (isProtectedRoute(request) && !(await convexAuth.isAuthenticated())) {
        return nextjsMiddlewareRedirect(request, "/sign-in");
      }
    })
  : (_request: NextRequest) => NextResponse.next();

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
