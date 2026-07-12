// CANONICAL — GET /api/billing/plans
// Display-safe plan catalog for the dashboard (upgrade panel, usage meter,
// pricing table). Never leaks Stripe price ids or env keys — only booleans
// saying whether checkout is configured, so the UI can hide broken buttons.
// Middleware requires auth on /api/**; the public landing/pricing pages
// (landing step) render their own static copy of this same catalog.

import { NextResponse } from 'next/server'
import {
  PLAN_ORDER,
  PRODUCT_SLUG,
  RIGFILE_PLANS,
  getPriceId,
  isPaidPlan,
  toPublicPlan,
} from '@/app/api/billing/_config/plans'

export const dynamic = 'force-dynamic'

export async function GET() {
  const plans = PLAN_ORDER.map((key) => {
    const plan = RIGFILE_PLANS[key]
    return {
      ...toPublicPlan(plan),
      checkout: isPaidPlan(key)
        ? {
            monthlyConfigured: Boolean(getPriceId(key, 'monthly')),
            yearlyConfigured: Boolean(getPriceId(key, 'yearly')),
          }
        : null,
    }
  })

  return NextResponse.json({ product: PRODUCT_SLUG, plans })
}
