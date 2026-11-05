import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";

// Route protection by role. API handlers re-check against the database as well.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const isApi = pathname.startsWith("/api/");
  const adminOnly = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (!session) {
    if (isApi) return NextResponse.json({ error: "Please log in" }, { status: 401 });
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (adminOnly && session.role !== "admin") {
    if (isApi) return NextResponse.json({ error: "Admins only" }, { status: 403 });
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/upload/:path*",
    "/search/:path*",
    "/documents/:path*",
    "/admin/:path*",
    "/api/folders/:path*",
    "/api/documents/:path*",
    "/api/search/:path*",
    "/api/stats/:path*",
    "/api/admin/:path*",
  ],
};
