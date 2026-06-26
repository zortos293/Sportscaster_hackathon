import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isAuthPage = createRouteMatcher(["/sign-in", "/sign-up"]);
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
const convexEnabled = Boolean(convexUrl && /^https?:\/\//.test(convexUrl));

export default convexEnabled
  ? convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
      if (isAuthPage(request) && (await convexAuth.isAuthenticated())) {
        return nextjsMiddlewareRedirect(request, "/dashboard");
      }

      if (isProtectedRoute(request) && !(await convexAuth.isAuthenticated())) {
        return nextjsMiddlewareRedirect(request, "/sign-in");
      }
    })
  : (_request: NextRequest) => NextResponse.next();

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
