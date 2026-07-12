/**
 * CANONICAL — RigFile plan catalog + Stripe price-ID resolution.
 *
 * CENTRAL PAYMENTS MODE: RigFile holds NO Stripe key and ships NO Stripe SDK.
 * A single central ZeroOrigine payments service owns the one Stripe account
 * and the one webhook. That central webhook writes entitlements into
 * rigfile_subscriptions / rigfile_payments; this product only READS those
 * tables. Webhook signature verification and event idempotency live in the
 * central service — never here.
 *
 * This file is a pure data module (safe to import from any route):
 *   - No SDK imports, no secrets, no module-level throws.
 *   - Price IDs come from server-only env vars, resolved lazily at call time.
 *
 * Required env vars (server-only — NEVER NEXT_PUBLIC_):
 *   PAYMENTS_URL                 Central checkout proxy endpoint
 *   PAYMENTS_PROXY_TOKEN         Bearer token for the central proxy
 *   STRIPE_PRICE_SOLO_MONTHLY    price_... id for Solo  $29/mo
 *   STRIPE_PRICE_SOLO_YEARLY     price_... id for Solo  $290/yr
 *   STRIPE_PRICE_FLEET_MONTHLY   price_... id for Fleet $99/mo
 *   STRIPE_PRICE_FLEET_YEARLY    price_... id for Fleet $990/yr
 *
 * Plan keys mirror the rigfile_plan enum in the database exactly:
 * free | solo | fleet. Do not invent tiers the schema cannot represent.
 */

export const PRODUCT_SLUG = 'rigfile' as const

export type RigfilePlanKey = 'free' | 'solo' | 'fleet'
export type PaidPlanKey = 'solo' | 'fleet'
export type BillingInterval = 'monthly' | 'yearly'

export interface RigfilePlanLimits {
  maxDrivers: number
  auditPdfs: boolean
  documentUploads: boolean
  customReminderWindow: boolean
}

export interface RigfilePlan {
  key: RigfilePlanKey
  name: string
  tagline: string
  monthlyPriceUsd: number
  yearlyPriceUsd: number
  features: string[]
  limits: RigfilePlanLimits
  highlight: boolean
}

export const RIGFILE_PLANS: Record<RigfilePlanKey, RigfilePlan> = {
  free: {
    key: 'free',
    name: 'Free',
    tagline: 'Start tracking today',
    monthlyPriceUsd: 0,
    yearlyPriceUsd: 0,
    features: [
      '1 driver (you)',
      'All 18 DQF items on one compliance calendar',
      'Live status on every item: valid, expiring soon, expired, missing',
      'Expiration dates tracked with a 30-day warning window',
    ],
    limits: { maxDrivers: 1, auditPdfs: false, documentUploads: false, customReminderWindow: false },
    highlight: false,
  },
  solo: {
    key: 'solo',
    name: 'Solo',
    tagline: 'For the owner-operator',
    monthlyPriceUsd: 29,
    yearlyPriceUsd: 290,
    features: [
      'Everything in Free',
      'Unlimited audit-ready DQF PDFs',
      'Document uploads on all 18 items',
      'Custom reminder window (1–365 days out)',
      'Priority support',
    ],
    limits: { maxDrivers: 1, auditPdfs: true, documentUploads: true, customReminderWindow: true },
    highlight: true,
  },
  fleet: {
    key: 'fleet',
    name: 'Fleet',
    tagline: 'For 1–10 truck operations',
    monthlyPriceUsd: 99,
    yearlyPriceUsd: 990,
    features: [
      'Everything in Solo',
      'Up to 10 drivers',
      'Audit-ready PDFs for every driver',
      'A compliance calendar per driver',
      'Priority support for your whole operation',
    ],
    limits: { maxDrivers: 10, auditPdfs: true, documentUploads: true, customReminderWindow: true },
    highlight: false,
  },
}

export const PLAN_ORDER: RigfilePlanKey[] = ['free', 'solo', 'fleet']

const PRICE_ENV_KEYS: Record<PaidPlanKey, Record<BillingInterval, string>> = {
  solo: { monthly: 'STRIPE_PRICE_SOLO_MONTHLY', yearly: 'STRIPE_PRICE_SOLO_YEARLY' },
  fleet: { monthly: 'STRIPE_PRICE_FLEET_MONTHLY', yearly: 'STRIPE_PRICE_FLEET_YEARLY' },
}

export function isPlanKey(value: unknown): value is RigfilePlanKey {
  return value === 'free' || value === 'solo' || value === 'fleet'
}

export function isPaidPlan(value: unknown): value is PaidPlanKey {
  return value === 'solo' || value === 'fleet'
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === 'monthly' || value === 'yearly'
}

export function getPriceEnvKey(plan: PaidPlanKey, interval: BillingInterval): string {
  return PRICE_ENV_KEYS[plan][interval]
}

/** Lazily resolved so a missing env var can never crash the build. */
export function getPriceId(plan: PaidPlanKey, interval: BillingInterval): string | null {
  const value = process.env[getPriceEnvKey(plan, interval)]
  return value && value.trim() ? value.trim() : null
}

/** Reverse lookup: which plan + interval does a Stripe price id belong to? */
export function getPlanByPriceId(priceId: string): { plan: PaidPlanKey; interval: BillingInterval } | null {
  const paidPlans: PaidPlanKey[] = ['solo', 'fleet']
  const intervals: BillingInterval[] = ['monthly', 'yearly']
  for (const plan of paidPlans) {
    for (const interval of intervals) {
      if (getPriceId(plan, interval) === priceId) return { plan, interval }
    }
  }
  return null
}

/** Display-safe shape for API responses — never leaks env keys or price ids. */
export function toPublicPlan(plan: RigfilePlan) {
  const { key, name, tagline, monthlyPriceUsd, yearlyPriceUsd, features, limits, highlight } = plan
  return { key, name, tagline, monthlyPriceUsd, yearlyPriceUsd, features, limits, highlight }
}
