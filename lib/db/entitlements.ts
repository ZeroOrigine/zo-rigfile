// CANONICAL: Plan limits for RigFile, enforced in the app layer per the schema:
//   free  = 1 driver, compliance calendar only
//   solo  = 1 driver + unlimited audit-ready PDFs
//   fleet = up to 10 drivers + unlimited audit-ready PDFs
// Stripe (via the auth/payments step's webhook) is the source of truth for the
// subscription row; this module only reads it and maps it to capabilities.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RigfilePlan, RigfileSubscriptionStatus } from './types'

export interface PlanLimits {
  plan: RigfilePlan
  label: string
  max_drivers: number
  can_generate_audit_pdf: boolean
}

export const PLAN_LIMITS: Record<RigfilePlan, PlanLimits> = {
  free: { plan: 'free', label: 'Free', max_drivers: 1, can_generate_audit_pdf: false },
  solo: { plan: 'solo', label: 'Solo', max_drivers: 1, can_generate_audit_pdf: true },
  fleet: { plan: 'fleet', label: 'Fleet', max_drivers: 10, can_generate_audit_pdf: true },
}

// past_due keeps access during the Stripe retry window — cutting a trucker off
// over a card hiccup during an audit would be unforgivable.
const ENTITLED_STATUSES: RigfileSubscriptionStatus[] = ['active', 'trialing', 'past_due']

export interface Entitlements extends PlanLimits {
  subscription_status: RigfileSubscriptionStatus
}

export async function getEntitlements(
  supabase: SupabaseClient,
  userId: string
): Promise<Entitlements> {
  const { data, error } = await supabase
    .from('rigfile_subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load subscription: ${error.message}`)
  }

  const plan = (data?.plan ?? 'free') as RigfilePlan
  const status = (data?.status ?? 'active') as RigfileSubscriptionStatus

  const effectivePlan: RigfilePlan =
    plan !== 'free' && !ENTITLED_STATUSES.includes(status) ? 'free' : plan

  return { ...PLAN_LIMITS[effectivePlan], subscription_status: status }
}
