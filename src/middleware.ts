import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/api/v1",
  "/api/auth/login",
  "/api/auth/session",
  "/_next",
  "/favicon.ico",
];

export function middleware(request: NextRequest) {
  if (process.env.DESKTOP_MODE === "true") return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Skip middleware for public paths
  for (const path of PUBLIC_PATHS) {
    if (pathname.startsWith(path)) {
      return NextResponse.next();
    }
  }

  // Check for session cookie
  const sessionToken = request.cookies.get("mm_session")?.value;
  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image).*)",
  ],
};
