// CANONICAL — GET /api/billing/subscription
// The single read model for billing state. Reads rigfile_subscriptions (which
// the CENTRAL payments webhook keeps up to date) plus live driver usage, and
// joins in the plan catalog so the dashboard can render plan, limits, and
// upgrade options from one call. RLS guarantees a user only sees their own row.
//
// Plan changes: run a new checkout via POST /api/checkout — the central
// service and Stripe handle proration and subscription swaps.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  RIGFILE_PLANS,
  getPlanByPriceId,
  isPlanKey,
  toPublicPlan,
  type RigfilePlanKey,
} from '@/app/api/billing/_config/plans'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Log in to see your plan.' }, { status: 401 })
    }

    const { data: row, error } = await supabase
      .from('rigfile_subscriptions')
      .select('plan, status, stripe_price_id, current_period_end, cancel_at_period_end')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('[rigfile:billing/subscription] Read failed', error)
      return NextResponse.json(
        { error: 'We couldn’t load your plan just now. Refresh in a moment.' },
        { status: 500 }
      )
    }

    // The signup trigger creates a free/active row; if it is somehow missing we
    // still answer with sane free-plan defaults instead of an empty screen.
    const planKey: RigfilePlanKey = row && isPlanKey(row.plan) ? row.plan : 'free'
    const planDef = RIGFILE_PLANS[planKey]
    const status = row?.status ?? 'active'
    const priceMatch = row?.stripe_price_id ? getPlanByPriceId(row.stripe_price_id) : null

    const { count: activeDrivers } = await supabase
      .from('rigfile_drivers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active')

    const isPaid = planKey !== 'free' && ['active', 'trialing', 'past_due'].includes(status)

    return NextResponse.json({
      subscription: {
        plan: planKey,
        status,
        interval: priceMatch?.interval ?? null,
        currentPeriodEnd: row?.current_period_end ?? null,
        cancelAtPeriodEnd: row?.cancel_at_period_end ?? false,
      },
      plan: toPublicPlan(planDef),
      isPaid,
      paymentProblem: status === 'past_due',
      usage: {
        activeDrivers: activeDrivers ?? 0,
        maxDrivers: planDef.limits.maxDrivers,
      },
    })
  } catch (err) {
    console.error('[rigfile:billing/subscription] Unexpected error', err)
    return NextResponse.json(
      { error: 'We couldn’t load your plan just now. Refresh in a moment.' },
      { status: 500 }
    )
  }
}
