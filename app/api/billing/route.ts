// CANONICAL — POST /api/billing  (customer portal hand-off, CENTRAL PAYMENTS MODE)
//
// SELF-VALIDATION FIX: the dashboard billing page POSTs here to open Stripe's
// customer portal, but no handler existed (404 HTML). This route:
//   1. Verifies the caller is logged in (middleware also gates /api/**).
//   2. Applies a same-origin check (CSRF, matching /api/checkout).
//   3. Proxies to the central payments portal endpoint when configured
//      (PAYMENTS_PORTAL_URL + PAYMENTS_PROXY_TOKEN), returning { url }.
//   4. Otherwise returns a designed JSON error the billing page renders as a
//      friendly toast — never a raw 404.
//
// No Stripe SDK, no Stripe key — the central ZeroOrigine service owns both.

import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase/server'
import { PRODUCT_SLUG } from '@/app/api/billing/_config/plans'

export const dynamic = 'force-dynamic'

function isTrustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true // Non-browser clients carry no Origin; auth still gates them.

  const trusted = new Set<string>()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    try {
      trusted.add(new URL(appUrl).origin)
    } catch {
      // Malformed env value — fall through to host-based checks.
    }
  }
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (host) {
    trusted.add(`https://${host}`)
    trusted.add(`http://${host}`)
  }
  return trusted.has(origin)
}

export async function POST(request: NextRequest) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json(
        { error: 'That request came from an unexpected place, so we stopped it to keep your account safe.' },
        { status: 403 }
      )
    }

    const context = await getAuthenticatedContext()
    if (!context) {
      return NextResponse.json({ error: 'Log in to manage your billing.' }, { status: 401 })
    }

    const portalUrl = process.env.PAYMENTS_PORTAL_URL
    const proxyToken = process.env.PAYMENTS_PROXY_TOKEN

    if (!portalUrl || !proxyToken) {
      // Graceful degradation: the billing page shows this message as a toast.
      return NextResponse.json(
        {
          error:
            'The billing portal is not available on this deployment yet. Email support@zeroorigine.com and we will change or cancel your plan same-day.',
        },
        { status: 503 }
      )
    }

    let proxyResponse: Response
    try {
      proxyResponse = await fetch(portalUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${proxyToken}`,
        },
        body: JSON.stringify({ product_slug: PRODUCT_SLUG, user_id: context.user.id }),
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      })
    } catch (err) {
      console.error('[rigfile:billing.portal] Payments portal unreachable', err)
      return NextResponse.json(
        { error: 'Our payments desk did not pick up. Nothing changed — try again in a minute.' },
        { status: 502 }
      )
    }

    if (!proxyResponse.ok) {
      const detail = await proxyResponse.text().catch(() => '')
      console.error(`[rigfile:billing.portal] Proxy returned ${proxyResponse.status}: ${detail.slice(0, 300)}`)
      return NextResponse.json(
        { error: 'Our payments desk did not pick up. Nothing changed — try again in a minute.' },
        { status: 502 }
      )
    }

    const payload = (await proxyResponse.json().catch(() => null)) as { url?: unknown } | null
    const url = payload && typeof payload.url === 'string' ? payload.url : null
    if (!url || !/^https?:\/\//.test(url)) {
      console.error('[rigfile:billing.portal] Proxy responded without a valid portal url')
      return NextResponse.json(
        { error: 'Our payments desk did not pick up. Nothing changed — try again in a minute.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ url })
  } catch (err) {
    console.error('[rigfile:billing.portal] Unexpected error', err)
    return NextResponse.json(
      { error: 'Something hiccuped on our side. Nothing changed — try again.' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Use POST to open the billing portal. Your plan details live at /api/billing/subscription.' },
    { status: 405 }
  )
}
