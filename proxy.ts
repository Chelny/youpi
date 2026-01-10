import { NextRequest, NextResponse } from "next/server";
import { betterFetch } from "@better-fetch/fetch";
import { APP_COOKIE_KEYS } from "@/constants/app";
import { PROTECTED_ROUTES, PUBLIC_ROUTES, ROUTE_GAMES, ROUTE_SIGN_IN } from "@/constants/routes";
import { Session } from "@/lib/auth";
import { getCurrentLocale } from "@/lib/locale";
import linguiConfig from "@/lingui.config";

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host: string | null = request.headers.get("host");
  const protocol: string = request.headers.get("x-forwarded-proto") || "http";
  const origin: string = `${protocol}://${host}`;

  // ---------------------------------------------
  // Fetch session
  // ---------------------------------------------

  const { data: session } = await betterFetch<Session>("/api/auth/get-session", {
    baseURL: request.nextUrl.origin,
    headers: {
      cookie: request.headers.get("cookie") || "",
    },
  });

  // ---------------------------------------------
  // Access control
  // ---------------------------------------------

  const pathnameParts: string[] = pathname.split("/");
  const maybeLocale: string = pathnameParts[1];
  const pathnameNoLocale: string = linguiConfig.locales.includes(maybeLocale)
    ? `/${pathnameParts.slice(2).join("/")}` || "/"
    : pathname;

  const isPublicRoute: boolean = PUBLIC_ROUTES.some((route: string) => pathnameNoLocale.startsWith(route));
  const isProtectedRoute: boolean = PROTECTED_ROUTES.some((route: string) => pathnameNoLocale.startsWith(route));

  if (session) {
    if (isPublicRoute) {
      return NextResponse.redirect(new URL(ROUTE_GAMES.PATH, origin));
    }
  } else {
    if (isProtectedRoute) {
      return NextResponse.redirect(new URL(ROUTE_SIGN_IN.PATH, origin));
    }
  }

  // ---------------------------------------------
  // Content Security Policy (CSP)
  // ---------------------------------------------

  const nonce: string = Buffer.from(crypto.randomUUID()).toString("base64");
  const devCspHeader: string = `
    default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;
    script-src * 'unsafe-inline' 'unsafe-eval' data: blob:;
    style-src * 'unsafe-inline' 'unsafe-eval' data: blob:;
    connect-src *;
    img-src * data: blob:;
    font-src * data:;
    object-src *;
    frame-ancestors *;
  `;
  const prodCspHeader: string = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    connect-src 'self' https://www.google-analytics.com;
    upgrade-insecure-requests;
  `;
  const cspHeader: string = process.env.NODE_ENV === "production" ? prodCspHeader : devCspHeader;
  const contentSecurityPolicyHeader: string = cspHeader.replace(/\s{2,}/g, " ").trim();

  const requestHeaders: Headers = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicyHeader);
  requestHeaders.set("x-nonce", nonce);

  const response: NextResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("Content-Security-Policy", contentSecurityPolicyHeader);

  // ---------------------------------------------
  // CORS
  // ---------------------------------------------

  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  const trustedOrigins: string[] = (process.env.TRUSTED_ORIGINS || "").split(",").map((origin: string) => origin.trim());

  if (origin && trustedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  } else {
    response.headers.set("Access-Control-Allow-Origin", trustedOrigins[0] || "*");
  }

  // ---------------------------------------------
  // Localization
  // ---------------------------------------------

  const cookieLocale: string | undefined = request.cookies.get(APP_COOKIE_KEYS.LOCALE)?.value;
  const locale: string = getCurrentLocale(request, session);
  const pathnameLocale: string = pathname.split("/")[1];

  if (!linguiConfig.locales.includes(pathnameLocale)) {
    // Redirect if there is no locale
    request.nextUrl.pathname = `/${locale}${pathname}`;
    // e.g. incoming request is /sign-in
    // The new URL is now /en/sign-in
    return NextResponse.redirect(request.nextUrl);
  }

  // Sync locale cookie
  if (pathnameLocale !== cookieLocale) {
    // If the locale in the cookie doesn't match the pathname locale, update the cookie
    response.cookies.set(APP_COOKIE_KEYS.LOCALE, pathnameLocale, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // Cache for 30 days
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

export const config = {
  matcher: [
    {
      /*
       * Match all request paths except for the ones starting with:
       * - api (API routes)
       * - _next/static (static files)
       * - _next/image (image optimization files)
       * - favicon.ico, sitemap.xml, robots.txt, manifest.webmanifest (metadata files)
       * - media files (svg, png, jpg, jpeg, gif, webp, webm)
       */
      source: "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
