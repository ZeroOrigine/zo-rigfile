// CANONICAL — RigFile session refresh + route protection middleware.
//
// Self-contained by design: middleware runs on every matched request, so it
// builds its own @supabase/ssr client inline instead of importing app-layer
// helpers (lib/supabase/** is owned by the API step; this file is the auth
// step's single source of truth for route protection).
//
// SELF-VALIDATION FIX: the dashboard route group serves /dashboard, /drivers,
// /audit-files, /settings, AND /billing — all five prefixes are now protected
// at the edge instead of relying on client-side 401 redirects.
//
// QA-001 FIX: /api/cron/** is now in OPEN_API_PREFIXES. The scheduler calls
// /api/cron/refresh-statuses with a Bearer CRON_SECRET header and no Supabase
// session cookie, so the middleware's blanket /api/** session gate was
// returning 401 before the route's own CRON_SECRET check could ever run —
// meaning the daily status refresh never executed. The cron route enforces
// its own Bearer-token auth (see app/api/cron/refresh-statuses/route.ts), so
// letting it past the session gate does not open an unauthenticated endpoint.
//
// Enforced rules:
//   1. Refresh the Supabase session on every matched request (token rotation).
//   2. Protected pages → logged-in users only. Others → /login?next=<path>.
//   3. /api/**        → logged-in users only (401 JSON, no redirect), EXCEPT
//        /api/auth/**     (handles its own auth responses)
//        /api/webhooks/** (reserved: the CENTRAL payments service owns the one
//                          Stripe webhook — this product ships no handler).
//        /api/cron/**     (scheduler requests authenticate with a Bearer
//                          CRON_SECRET, not a session cookie; the route
//                          enforces that check itself).
//   4. /login and /signup → logged-out users only. Logged-in → /dashboard.
//
// Cookie posture: Supabase SSR cookies are Secure + SameSite=Lax, which is the
// first line of CSRF defense for every state-changing route. Money-touching
// routes add a same-origin check on top (see app/api/checkout/route.ts).
//
// Rate limiting (documented, enforced at the platform edge): apply per-IP
// limits to /login, /signup, /forgot-password (≈10 req/min) and per-user
// limits to /api/checkout (≈10 req/min).

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PAGE_PREFIXES = ['/dashboard', '/drivers', '/audit-files', '/settings', '/billing']
const LOGGED_OUT_ONLY_PAGES = ['/login', '/signup']
const OPEN_API_PREFIXES = ['/api/auth', '/api/webhooks', '/api/cron']

function startsWithPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

function withCookies(source: NextResponse, target: NextResponse): NextResponse {
  // Carry refreshed auth cookies over onto redirect responses so the session
  // rotation performed above is never lost.
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie))
  return target
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  let user: { id: string } | null = null

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    })

    // getUser() validates the JWT against Supabase Auth — never trust
    // getSession() alone for authorization decisions.
    const { data } = await supabase.auth.getUser()
    user = data.user ?? null
  }

  const isApiRoute = pathname.startsWith('/api')
  const isOpenApi = OPEN_API_PREFIXES.some((p) => startsWithPrefix(pathname, p))
  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some((p) => startsWithPrefix(pathname, p))
  const isLoggedOutOnlyPage = LOGGED_OUT_ONLY_PAGES.includes(pathname)

  if (!user && isApiRoute && !isOpenApi) {
    // API callers get a clean 401 instead of an HTML redirect.
    return NextResponse.json(
      { error: 'You need to be logged in for that. Log in and try again.' },
      { status: 401 }
    )
  }

  if (!user && isProtectedPage) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return withCookies(response, NextResponse.redirect(loginUrl))
  }

  if (user && isLoggedOutOnlyPage) {
    return withCookies(response, NextResponse.redirect(new URL('/dashboard', request.url)))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff2?)$).*)',
  ],
}
