'use client'
// CANONICAL: components/marketing/pricing-section.tsx — shared pricing tiers + monthly/annual toggle (used on / and /pricing)
// SELF-VALIDATION FIX: tiers now match the enforced entitlements exactly —
// Free (1 driver, calendar only) / Solo $29 (1 driver + unlimited audit PDFs) /
// Fleet $99 (up to 10 drivers). Previous copy invented 'Pro/Enterprise' tiers
// with driver limits the product does not enforce. Escape-sequence text bugs fixed.

import Link from 'next/link'
import { useState } from 'react'

function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

type Tier = {
  id: 'free' | 'solo' | 'fleet'
  name: string
  blurb: string
  monthly: string
  annual: string
  monthlyPer: string
  annualPer: string
  saveNote: string | null
  features: string[]
  ctaMonthly: string
  ctaAnnual: string
  hrefMonthly: string
  hrefAnnual: string
  featured?: boolean
  footnote: string
}

const TIERS: Tier[] = [
  {
    id: 'free',
    name: 'Free',
    blurb: 'The complete compliance calendar for one driver. Free forever — not a trial.',
    monthly: '$0',
    annual: '$0',
    monthlyPer: 'forever',
    annualPer: 'forever',
    saveNote: null,
    features: [
      '1 driver file (you)',
      'All 18 DQF items tracked',
      'Color-coded expiration calendar',
      'Live status on every item: valid, expiring soon, expired, missing',
      'Warning window before anything expires (30 days by default)',
      'Export your data anytime',
    ],
    ctaMonthly: 'Start Free',
    ctaAnnual: 'Start Free',
    hrefMonthly: '/signup',
    hrefAnnual: '/signup',
    footnote: 'No credit card required.',
  },
  {
    id: 'solo',
    name: 'Solo',
    blurb: 'Full audit protection for the owner-operator — the PDF that proves you are covered.',
    monthly: '$29',
    annual: '$290',
    monthlyPer: '/month',
    annualPer: '/year',
    saveNote: 'Two months free — save $58/yr',
    features: [
      'Everything in Free',
      'Unlimited audit-ready DQF PDFs',
      'Attach photos & scans to every item',
      'Custom warning window (1–365 days out)',
      'Dated archive of every audit PDF you generate',
      'Priority email support',
    ],
    ctaMonthly: 'Get Solo — $29/mo',
    ctaAnnual: 'Get Solo — $290/yr',
    hrefMonthly: '/signup?plan=solo&billing=monthly',
    hrefAnnual: '/signup?plan=solo&billing=annual',
    featured: true,
    footnote: 'No contracts — cancel anytime.',
  },
  {
    id: 'fleet',
    name: 'Fleet',
    blurb: 'The same audit protection for small operations running up to 10 trucks.',
    monthly: '$99',
    annual: '$990',
    monthlyPer: '/month',
    annualPer: '/year',
    saveNote: 'Two months free — save $198/yr',
    features: [
      'Everything in Solo',
      'Up to 10 driver files',
      'Audit-ready PDFs for every driver',
      'Per-driver status board — spot trouble at a glance',
      'One compliance calendar across your fleet',
    ],
    ctaMonthly: 'Get Fleet — $99/mo',
    ctaAnnual: 'Get Fleet — $990/yr',
    hrefMonthly: '/signup?plan=fleet&billing=monthly',
    hrefAnnual: '/signup?plan=fleet&billing=annual',
    footnote: 'No contracts — cancel anytime.',
  },
]

export default function PricingSection({ showHeading = true }: { showHeading?: boolean }) {
  const [annual, setAnnual] = useState(false)

  const segClass = (active: boolean) =>
    `min-h-[44px] rounded-full px-5 text-sm font-semibold transition-colors ${
      active
        ? 'bg-slate-900 text-white shadow dark:bg-amber-500 dark:text-slate-950'
        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
    }`

  return (
    <section id="pricing" className="scroll-mt-20 bg-white py-20 sm:py-24 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {showHeading && (
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">Pricing</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              The free plan is a complete calendar.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              Track your entire file, free, forever. Pay only when you want the audit-ready PDF in hand —
              or your operation grows past one driver.
            </p>
          </div>
        )}

        <div className={showHeading ? 'mt-10 flex justify-center' : 'flex justify-center'}>
          <div
            role="group"
            aria-label="Billing period"
            className="inline-flex rounded-full bg-slate-100 p-1 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-white/10"
          >
            <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)} className={segClass(!annual)}>
              Monthly
            </button>
            <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)} className={segClass(annual)}>
              Annual — 2 months free
            </button>
          </div>
        </div>

        <div className="mx-auto mt-12 grid max-w-md grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-3">
          {TIERS.map((tier) => {
            const featured = Boolean(tier.featured)
            return (
              <div
                key={tier.id}
                className={`relative flex flex-col rounded-2xl p-8 ${
                  featured
                    ? 'bg-slate-900 shadow-2xl ring-2 ring-amber-500'
                    : 'bg-white ring-1 ring-slate-200 dark:bg-slate-900/40 dark:ring-white/10'
                }`}
              >
                {featured && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-950">
                    Most popular
                  </span>
                )}

                <h3 className={`font-display text-lg font-bold ${featured ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {tier.name}
                </h3>
                <p className={`mt-2 text-sm leading-relaxed ${featured ? 'text-slate-300' : 'text-slate-600 dark:text-slate-300'}`}>
                  {tier.blurb}
                </p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className={`font-display text-4xl font-bold tracking-tight ${featured ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {annual ? tier.annual : tier.monthly}
                  </span>
                  <span className={`text-sm ${featured ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    {annual ? tier.annualPer : tier.monthlyPer}
                  </span>
                </div>
                <p className="mt-1 h-5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {annual && tier.saveNote ? tier.saveNote : '\u00A0'}
                </p>

                <ul className="mt-6 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <span className={`mt-0.5 flex-none ${featured ? 'text-amber-400' : 'text-amber-500 dark:text-amber-400'}`}>
                        <CheckIcon />
                      </span>
                      <span className={`text-sm leading-relaxed ${featured ? 'text-slate-200' : 'text-slate-600 dark:text-slate-300'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={annual ? tier.hrefAnnual : tier.hrefMonthly}
                  className={`mt-8 inline-flex min-h-[44px] items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-colors ${
                    featured
                      ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                      : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white/10 dark:text-white dark:hover:bg-white/20'
                  }`}
                >
                  {annual ? tier.ctaAnnual : tier.ctaMonthly}
                </Link>
                <p className={`mt-3 text-center text-xs ${featured ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  {tier.footnote}
                </p>
              </div>
            )
          })}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-slate-500 dark:text-slate-400">
          Prices in USD. Payments handled securely by Stripe. Your data is yours on every plan — export it
          or delete it anytime.
        </p>
      </div>
    </section>
  )
}
