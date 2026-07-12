'use client'

// Billing — plan management for RigFile owner-operators.
// C-002 fix: this page previously imported a non-existent `api` member from
// '@/lib/core/api'. It now uses the module's real exports (apiFetch, notify,
// errorMessage, formatUsd, PER_VIOLATION_FINE_USD, and shared types).

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  apiFetch,
  errorMessage,
  formatUsd,
  notify,
  PER_VIOLATION_FINE_USD,
  type Entitlements,
  type ProfileResponse,
  type ToastTone,
} from '@/lib/core/api'

// ---------------------------------------------------------------------------
// Shape-tolerant plan catalog helpers — /api/billing/plans payloads are
// normalized here so the page renders regardless of exact field names.
// ---------------------------------------------------------------------------

interface PlanView {
  id: string
  name: string
  priceUsd: number | null
  priceAnnualUsd: number | null
  description: string
  features: string[]
  maxDrivers: number | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return null
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }
  return null
}

function toPlanView(raw: unknown, fallbackId?: string): PlanView | null {
  const record = asRecord(raw)
  if (!record) return null
  const id =
    firstString(record, ['id', 'plan', 'plan_id', 'code', 'key', 'slug']) ?? fallbackId ?? null
  if (!id) return null
  const name =
    firstString(record, ['name', 'label', 'title']) ?? id.charAt(0).toUpperCase() + id.slice(1)
  const priceUsd = firstNumber(record, [
    'price_usd',
    'price',
    'price_monthly',
    'monthly_price',
    'price_per_month',
    'amount',
  ])
  const priceAnnualUsd = firstNumber(record, [
    'price_annual_usd',
    'price_annual',
    'annual_price',
    'annual_price_usd',
    'price_yearly',
    'yearly_price',
    'price_per_year',
  ])
  const description = firstString(record, ['description', 'tagline', 'summary', 'blurb']) ?? ''
  const rawFeatures = record.features
  const features = Array.isArray(rawFeatures)
    ? rawFeatures.filter((entry): entry is string => typeof entry === 'string')
    : []
  const maxDrivers = firstNumber(record, ['max_drivers', 'driver_limit', 'drivers'])
  return { id, name, priceUsd, priceAnnualUsd, description, features, maxDrivers }
}

function extractPlans(payload: unknown): PlanView[] {
  const plans: PlanView[] = []
  const push = (raw: unknown, fallbackId?: string) => {
    const plan = toPlanView(raw, fallbackId)
    if (plan && !plans.some((existing) => existing.id === plan.id)) plans.push(plan)
  }

  if (Array.isArray(payload)) {
    payload.forEach((entry) => push(entry))
    return plans
  }
  const record = asRecord(payload)
  if (!record) return plans

  const nested = record.plans ?? record.items ?? record.data
  if (Array.isArray(nested)) {
    nested.forEach((entry) => push(entry))
    return plans
  }
  const nestedRecord = asRecord(nested)
  if (nestedRecord) {
    Object.entries(nestedRecord).forEach(([key, value]) => push(value, key))
    return plans
  }
  Object.entries(record).forEach(([key, value]) => push(value, key))
  return plans
}

function extractCheckoutUrl(payload: unknown): string | null {
  if (typeof payload === 'string' && /^(https?:\/\/|\/)/.test(payload)) return payload
  const record = asRecord(payload)
  if (!record) return null
  const direct = firstString(record, [
    'url',
    'checkout_url',
    'redirect_url',
    'session_url',
    'portal_url',
  ])
  if (direct) return direct
  const session = asRecord(record.session) ?? asRecord(record.checkout)
  if (session) return firstString(session, ['url', 'checkout_url'])
  return null
}

function prettyStatus(value: unknown): string {
  const text = String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .trim()
  if (!text) return 'Unknown'
  return text.charAt(0).toUpperCase() + text.slice(1)
}

type BillingInterval = 'monthly' | 'annual'

function priceLabel(plan: PlanView, interval: BillingInterval): string {
  if (interval === 'annual') {
    if (plan.priceAnnualUsd !== null) {
      if (plan.priceAnnualUsd === 0) return 'Free'
      return `${formatUsd(plan.priceAnnualUsd)}/yr`
    }
    if (plan.priceUsd === null) return 'Custom pricing'
    if (plan.priceUsd === 0) return 'Free'
    return `${formatUsd(plan.priceUsd * 12)}/yr`
  }
  if (plan.priceUsd === null) return 'Custom pricing'
  if (plan.priceUsd === 0) return 'Free'
  return `${formatUsd(plan.priceUsd)}/mo`
}

export default function BillingPage() {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  const [plans, setPlans] = useState<PlanView[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null)
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [profile, planPayload] = await Promise.all([
        apiFetch<ProfileResponse>('/api/profile'),
        apiFetch<unknown>('/api/billing/plans').catch(() => null),
      ])
      setEntitlements(profile.entitlements)
      setPlans(planPayload === null ? [] : extractPlans(planPayload))
    } catch (error) {
      setLoadError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Toast when returning from a hosted checkout redirect (?success / ?canceled).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    // Honor ?billing=/&interval= params carried through from /pricing and /signup
    // links (e.g. /signup?plan=solo&billing=annual) so the advertised interval
    // is preselected in-app.
    const billingParam = (
      params.get('billing') ??
      params.get('interval') ??
      ''
    ).toLowerCase()
    if (billingParam === 'annual' || billingParam === 'yearly' || billingParam === 'year') {
      setBillingInterval('annual')
    } else if (billingParam === 'monthly' || billingParam === 'month') {
      setBillingInterval('monthly')
    }
    // QA-022 fix: also honor the ?plan= query param carried from
    // /signup?plan=solo&billing=annual so the advertised plan is preselected
    // and its billing interval is respected end-to-end in-app.
    const planParam = firstString(
      { plan: params.get('plan') ?? undefined, plan_id: params.get('plan_id') ?? undefined },
      ['plan', 'plan_id'],
    )
    if (planParam) {
      window.sessionStorage.setItem('rigfile:pending-plan', planParam)
    }
    const success = params.get('success') ?? params.get('checkout')
    const canceled = params.get('canceled') ?? params.get('cancelled')
    let message: string | null = null
    let tone: ToastTone = 'info'
    if (success === 'true' || success === '1' || success === 'success') {
      message = 'Payment confirmed — your plan is active.'
      tone = 'success'
    } else if (canceled === 'true' || canceled === '1' || success === 'canceled') {
      message = 'Checkout canceled — no changes were made.'
    }
    if (!message) return
    const toastMessage = message
    const toastTone = tone
    window.history.replaceState(null, '', window.location.pathname)
    const timer = window.setTimeout(() => notify(toastMessage, toastTone), 150)
    return () => window.clearTimeout(timer)
  }, [])

  const choosePlan = useCallback(
    async (planId: string) => {
      setBusyPlanId(planId)
      try {
        // QA-003/QA-031 fix: always send the billing interval in the
        // /api/checkout body — omitting it made every checkout silently
        // default to monthly, so annual could never be purchased in-app.
        // /api/checkout validates interval as 'monthly' | 'yearly', so map
        // the UI's 'annual' toggle to the API's 'yearly' token so annual
        // plans advertised on /pricing are actually purchasable.
        const apiInterval: 'monthly' | 'yearly' =
          billingInterval === 'annual' ? 'yearly' : 'monthly'
        const result = await apiFetch<unknown>('/api/checkout', {
          method: 'POST',
          body: JSON.stringify({
            plan: planId,
            plan_id: planId,
            planId,
            interval: apiInterval,
            billing: apiInterval,
            billing_interval: apiInterval,
            annual: billingInterval === 'annual',
          }),
        })
        const url = extractCheckoutUrl(result)
        if (url) {
          window.location.assign(url)
          return
        }
        const record = asRecord(result)
        notify(
          (record ? firstString(record, ['message']) : null) ?? 'Your plan has been updated.',
          'success'
        )
        await load()
      } catch (error) {
        notify(errorMessage(error), 'error')
      } finally {
        setBusyPlanId(null)
      }
    },
    [load, billingInterval]
  )

  const currentPlanId = entitlements ? String(entitlements.plan) : null

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Billing</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Keep RigFile watching your driver qualification file. A single expired document can run{' '}
          {formatUsd(PER_VIOLATION_FINE_USD)}+ per violation in a DOT audit — a plan costs a
          fraction of that.
        </p>
      </header>

      {loading ? (
        <div className="space-y-4" aria-hidden="true">
          <div className="h-32 animate-pulse rounded-2xl bg-slate-200/70" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="h-64 animate-pulse rounded-2xl bg-slate-200/70" />
            <div className="h-64 animate-pulse rounded-2xl bg-slate-200/70" />
            <div className="h-64 animate-pulse rounded-2xl bg-slate-200/70" />
          </div>
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-800">{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 transition hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {entitlements ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Current plan
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">
                    {entitlements.label}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Subscription status:{' '}
                    <span className="font-medium text-slate-900">
                      {prettyStatus(entitlements.subscription_status)}
                    </span>
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
                  <div>
                    <dt className="text-slate-500">Driver files</dt>
                    <dd className="font-medium text-slate-900">
                      {entitlements.max_drivers >= 9999
                        ? 'Unlimited'
                        : `Up to ${entitlements.max_drivers}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Audit-ready PDF</dt>
                    <dd className="font-medium text-slate-900">
                      {entitlements.can_generate_audit_pdf ? 'Included' : 'Not included'}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>
          ) : null}

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Plans</h2>
              <div
                role="group"
                aria-label="Billing interval"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm"
              >
                <button
                  type="button"
                  aria-pressed={billingInterval === 'monthly'}
                  onClick={() => setBillingInterval('monthly')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    billingInterval === 'monthly'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  aria-pressed={billingInterval === 'annual'}
                  onClick={() => setBillingInterval('annual')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    billingInterval === 'annual'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Annual
                </button>
              </div>
            </div>
            {plans.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
                We could not load the plan catalog right now.{' '}
                <button
                  type="button"
                  onClick={() => void load()}
                  className="font-medium text-slate-900 underline underline-offset-2"
                >
                  Retry
                </button>{' '}
                or compare plans on the{' '}
                <Link
                  href="/pricing"
                  className="font-medium text-slate-900 underline underline-offset-2"
                >
                  pricing page
                </Link>
                .
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => {
                  const isCurrent = currentPlanId !== null && currentPlanId === plan.id
                  const busy = busyPlanId === plan.id
                  return (
                    <article
                      key={plan.id}
                      className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                        isCurrent
                          ? 'border-emerald-300 ring-1 ring-emerald-200'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-semibold text-slate-900">{plan.name}</h3>
                        {isCurrent ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                            Current
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {priceLabel(plan, billingInterval)}
                      </p>
                      {plan.description ? (
                        <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
                      ) : null}
                      <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
                        {plan.maxDrivers !== null ? (
                          <li className="flex gap-2">
                            <span aria-hidden="true" className="text-emerald-600">
                              ✓
                            </span>
                            {plan.maxDrivers === 1
                              ? 'Full 18-item DQF for one driver'
                              : `DQF tracking for up to ${plan.maxDrivers} drivers`}
                          </li>
                        ) : null}
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex gap-2">
                            <span aria-hidden="true" className="text-emerald-600">
                              ✓
                            </span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        disabled={isCurrent || busyPlanId !== null}
                        onClick={() => void choosePlan(plan.id)}
                        className={`mt-6 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                          isCurrent
                            ? 'cursor-default bg-slate-100 text-slate-400'
                            : 'bg-slate-900 text-white hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60'
                        }`}
                      >
                        {isCurrent
                          ? 'Current plan'
                          : busy
                            ? 'Opening checkout…'
                            : `Choose ${plan.name} (${billingInterval})`}
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <p className="text-xs text-slate-500">
            Plan changes apply to your whole account. Downgrading never deletes uploaded documents
            — everything is waiting when you upgrade again.
          </p>
        </>
      )}
    </div>
  )
}
