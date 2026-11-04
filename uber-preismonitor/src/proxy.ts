/**
 * Zugriffsschutz für alle Seiten und API-Endpunkte.
 * Öffentlich: /login, /api/auth/login, /api/health, statische Dateien.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, safeEqual, verifySessionToken } from "./lib/session";

const PUBLIC = ["/login", "/api/auth/login", "/api/health", "/sw.js", "/manifest.webmanifest", "/icon.svg"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p) || pathname.startsWith("/_next/")) return NextResponse.next();

  const apiToken = (process.env.API_TOKEN || "").trim().replace(/^(["'])(.*)\1$/, "$2");
  const authz = req.headers.get("authorization") || "";
  if (apiToken && authz.startsWith("Bearer ") && safeEqual(authz.slice(7), apiToken)) return NextResponse.next();

  const user = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
  if (user) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
