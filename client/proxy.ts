import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isAuthenticated = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/login");
  const isGettingStartedPage = req.nextUrl.pathname === "/getting-started";
  const isPublicPage = req.nextUrl.pathname === "/" || isAuthPage;

  // Redirect authenticated users away from login page
  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/home", req.url));
  }

  if(isPublicPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/home", req.url));
  }

  // Redirect unauthenticated users to login for protected pages (all pages except home and login)
  if (!isAuthenticated && !isPublicPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Check onboarding completion for authenticated users
  if (isAuthenticated && req.auth?.user) {
    const onboardingCompleted = req.auth.user.onboardingCompleted;
    
    // If onboarding not completed and not on getting-started page, redirect to getting-started
    if (!onboardingCompleted && !isGettingStartedPage && !isPublicPage) {
      return NextResponse.redirect(new URL("/getting-started", req.url));
    }
    
    // If onboarding completed and trying to access getting-started, redirect to home
    if (onboardingCompleted && isGettingStartedPage) {
      return NextResponse.redirect(new URL("/home", req.url));
    }
  }

  return NextResponse.next();
});

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
