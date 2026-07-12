// CANONICAL — POST /api/checkout  (CENTRAL PAYMENTS MODE)
//
// RigFile holds NO Stripe key and imports NO Stripe SDK. This route:
//   1. Verifies the caller is a logged-in RigFile user (Supabase Auth).
//   2. Applies a same-origin check on top of SameSite cookies (CSRF).
//   3. Resolves the Stripe price id from server-only env config.
//   4. POSTs to the central ZeroOrigine payments proxy (PAYMENTS_URL) with
//      exactly: { product_slug, price_id, user_id } and the proxy bearer token.
//   5. Returns the { url } the proxy answers with; the client redirects there.
//
// Entitlements are written back into rigfile_subscriptions by the CENTRAL
// webhook — this product never verifies Stripe signatures and never stores
// card details (Stripe Checkout owns PCI compliance).
//
// Rate limiting note: apply a per-user edge limit (~10 req/min) here.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  PRODUCT_SLUG,
  RIGFILE_PLANS,
  getPriceEnvKey,
  getPriceId,
  isBillingInterval,
  isPaidPlan,
} from '@/app/api/billing/_config/plans'

export const dynamic = 'force-dynamic'

const CONFIG_ERROR_MESSAGE =
  'Checkout isn’t available right now. Nothing was charged — please try again shortly.'

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
    // --- CSRF: same-origin check on top of SameSite=Lax cookies -------------
    if (!isTrustedOrigin(request)) {
      return NextResponse.json(
        { error: 'That request came from an unexpected place, so we stopped it to keep your account safe.' },
        { status: 403 }
      )
    }

    // --- Auth ----------------------------------------------------------------
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Log in first, then pick your plan.' }, { status: 401 })
    }

    // --- Input validation ------------------------------------------------------
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Send JSON like { "plan": "solo", "interval": "monthly" }.' },
        { status: 400 }
      )
    }

    const rawPlan = typeof (body as { plan?: unknown })?.plan === 'string' ? (body as { plan: string }).plan.toLowerCase() : ''
    const rawInterval =
      typeof (body as { interval?: unknown })?.interval === 'string'
        ? (body as { interval: string }).interval.toLowerCase()
        : 'monthly'

    if (rawPlan === 'free') {
      return NextResponse.json(
        { error: 'The Free plan doesn’t need a checkout — you already have it. Pick Solo or Fleet to upgrade.' },
        { status: 400 }
      )
    }
    if (!isPaidPlan(rawPlan)) {
      return NextResponse.json({ error: 'Pick a real plan: "solo" or "fleet".' }, { status: 400 })
    }
    if (!isBillingInterval(rawInterval)) {
      return NextResponse.json({ error: 'Billing interval must be "monthly" or "yearly".' }, { status: 400 })
    }

    const priceId = getPriceId(rawPlan, rawInterval)
    if (!priceId) {
      console.error(`[rigfile:checkout] Missing price env var ${getPriceEnvKey(rawPlan, rawInterval)}`)
      return NextResponse.json({ error: CONFIG_ERROR_MESSAGE }, { status: 500 })
    }

    // --- Guard: never double-charge the exact same subscription price --------
    const { data: sub } = await supabase
      .from('rigfile_subscriptions')
      .select('stripe_price_id, status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (sub && sub.stripe_price_id === priceId && ['active', 'trialing'].includes(sub.status)) {
      return NextResponse.json(
        { error: `You’re already on ${RIGFILE_PLANS[rawPlan].name} (${rawInterval}). No need to pay twice.` },
        { status: 409 }
      )
    }

    // --- Central payments proxy ------------------------------------------------
    const paymentsUrl = process.env.PAYMENTS_URL
    const proxyToken = process.env.PAYMENTS_PROXY_TOKEN
    if (!paymentsUrl || !proxyToken) {
      console.error('[rigfile:checkout] PAYMENTS_URL / PAYMENTS_PROXY_TOKEN not configured')
      return NextResponse.json({ error: CONFIG_ERROR_MESSAGE }, { status: 500 })
    }

    let proxyResponse: Response
    try {
      proxyResponse = await fetch(paymentsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${proxyToken}`,
        },
        body: JSON.stringify({
          product_slug: PRODUCT_SLUG,
          price_id: priceId,
          user_id: user.id,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      })
    } catch (err) {
      console.error('[rigfile:checkout] Payments proxy unreachable', err)
      return NextResponse.json(
        { error: 'Our payments desk didn’t pick up. Nothing was charged — try again in a minute.' },
        { status: 502 }
      )
    }

    if (!proxyResponse.ok) {
      const detail = await proxyResponse.text().catch(() => '')
      console.error(`[rigfile:checkout] Proxy returned ${proxyResponse.status}: ${detail.slice(0, 500)}`)
      return NextResponse.json(
        { error: 'Our payments desk didn’t pick up. Nothing was charged — try again in a minute.' },
        { status: 502 }
      )
    }

    const payload = (await proxyResponse.json().catch(() => null)) as { url?: unknown } | null
    const url = payload && typeof payload.url === 'string' ? payload.url : null
    if (!url || !/^https?:\/\//.test(url)) {
      console.error('[rigfile:checkout] Proxy responded without a valid checkout url')
      return NextResponse.json(
        { error: 'Our payments desk didn’t pick up. Nothing was charged — try again in a minute.' },
        { status: 502 }
      )
    }

    // Client contract: fetch this route, then window.location.href = url
    return NextResponse.json({ url })
  } catch (err) {
    console.error('[rigfile:checkout] Unexpected error', err)
    return NextResponse.json(
      { error: 'Something hiccuped on our side. Nothing was charged — try again.' },
      { status: 500 }
    )
  }
}
