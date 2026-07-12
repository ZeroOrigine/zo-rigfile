// CANONICAL: app/pricing/page.tsx — RigFile pricing page (tiers with annual toggle, included-in-all strip, plan FAQ, final CTA, footer)
// SELF-VALIDATION FIX: plan names/limits aligned to Free/Solo/Fleet (the enforced
// entitlements), the all-plans strip no longer promises audit PDFs on Free, and
// literal \u-escape text bugs in JSX are replaced with real characters.
import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingNav from '@/components/marketing/nav'
import PricingSection from '@/components/marketing/pricing-section'

export const metadata: Metadata = {
  title: 'Pricing — Free Forever for One Driver | RigFile',
  description:
    'RigFile is free forever for one driver: all 18 DQF items on a color-coded compliance calendar with expiration warnings. Solo at $29/mo adds unlimited audit-ready PDFs; Fleet at $99/mo covers up to 10 drivers.',
  openGraph: {
    title: 'RigFile Pricing — Free Forever for One Driver',
    description:
      'Track your complete driver qualification file free, forever. Upgrade for audit-ready PDFs or more drivers.',
    type: 'website',
    url: '/pricing',
    siteName: 'RigFile',
  },
  alternates: { canonical: '/pricing' },
}

/* ---------------------------------- Icons ---------------------------------- */

type IconProps = { className?: string }

function IconTruck({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="1" y="4" width="14" height="11" rx="1" />
      <path d="M15 9h4l3 3v3h-7V9z" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  )
}

function IconCheck({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function IconArrow({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}

function IconPlus({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/* ---------------------------------- Data ---------------------------------- */

const INCLUDED = [
  'All 18 §391.51 DQF items',
  'Color-coded expiration calendar',
  'Warnings before anything expires',
  'Automatic daily status updates',
  'Export your data anytime',
  'Cancel anytime — no contracts',
]

const PLAN_FAQS = [
  {
    q: 'Can I really stay on the free plan forever?',
    a: 'Yes. One driver file, all 18 DQF items, and the color-coded calendar with a warning window before anything expires — free, forever, no credit card. It isn\u2019t a trial and it doesn\u2019t expire. Upgrade to Solo when you want unlimited audit-ready PDF exports, or Fleet when you run more than one driver.',
  },
  {
    q: 'What happens to my data if I downgrade?',
    a: 'Nothing gets deleted. Your drivers, dates, and documents stay exactly where you left them — you just can\u2019t add drivers beyond the new plan\u2019s limit, and audit-PDF export follows your new plan. Upgrade again anytime and everything is waiting.',
  },
  {
    q: 'How does annual billing work?',
    a: 'Pay for ten months, get twelve: Solo is $290/year and Fleet is $990/year. You can switch between monthly and annual — or between plans — whenever you like.',
  },
  {
    q: 'How do I pay?',
    a: 'All major credit and debit cards, processed securely by Stripe. RigFile never sees or stores your card number.',
  },
  {
    q: 'Is there a contract or cancellation fee?',
    a: 'No contracts, no fees. Cancel from your account in a couple of clicks, and your plan stays active through the end of the period you already paid for.',
  },
]

/* ---------------------------------- Page ----------------------------------- */

export default function PricingPage() {
  return (
    <div className="bg-white dark:bg-slate-950">
      <MarketingNav />
      <main>
        <section className="relative overflow-hidden bg-slate-950">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_-10%,rgba(245,158,11,0.16),transparent)]"
          />
          <div className="relative mx-auto max-w-3xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pt-20 lg:px-8">
            <p className="inline-flex items-center rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 ring-1 ring-inset ring-amber-500/30">
              Free forever for one driver — no credit card
            </p>
            <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Pricing that respects the one-truck operation.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
              No per-seat games, no “contact sales” wall, no fleet minimums. The free plan is a complete
              compliance calendar. The paid plans are for when you want the audit PDF in hand — or more trucks.
            </p>
          </div>
        </section>

        <PricingSection showHeading={false} />

        <section className="bg-slate-50 py-16 sm:py-20 dark:bg-slate-900">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              Every plan includes the essentials.
            </h2>
            <ul className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                    <IconCheck className="h-3 w-3" />
                  </span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-white py-20 sm:py-24 dark:bg-slate-950">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              Plan questions, answered.
            </h2>
            <div className="mt-10 space-y-3">
              {PLAN_FAQS.map((faq) => (
                <details
                  key={faq.q}
                  className="group rounded-xl border border-slate-200 bg-white open:shadow-sm dark:border-white/10 dark:bg-slate-900/40"
                >
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-slate-900 dark:text-white [&::-webkit-details-marker]:hidden">
                    <span>{faq.q}</span>
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-transform duration-200 group-open:rotate-45 dark:bg-white/10 dark:text-slate-300">
                      <IconPlus className="h-3.5 w-3.5" />
                    </span>
                  </summary>
                  <div className="px-5 pb-5">
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{faq.a}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-slate-950 py-20 sm:py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_100%,rgba(245,158,11,0.14),transparent)]"
          />
          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Start with the free plan tonight.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-slate-300">
              If RigFile doesn’t make your file easier to keep current, it cost you nothing to find out.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/signup"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-lg bg-amber-500 px-8 py-3.5 text-base font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition-colors hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                Get Started Free
                <IconArrow />
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-400">No credit card required. Upgrade only if your operation grows.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

/* --------------------------------- Footer ---------------------------------- */

function SiteFooter() {
  const year = new Date().getFullYear()
  const columns = [
    {
      heading: 'Product',
      links: [
        { label: 'Features', href: '/#features' },
        { label: 'How it works', href: '/#how-it-works' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'FAQ', href: '/#faq' },
      ],
    },
    {
      heading: 'Account',
      links: [
        { label: 'Log in', href: '/login' },
        { label: 'Create free account', href: '/signup' },
      ],
    },
    {
      heading: 'Support & Legal',
      links: [
        { label: 'Contact support', href: 'mailto:support@zeroorigine.com' },
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Terms of Service', href: '/terms' },
      ],
    },
  ]
  return (
    <footer className="border-t border-white/10 bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-slate-950">
                <IconTruck />
              </span>
              <span className="font-display text-lg font-bold tracking-tight text-white">RigFile</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              The DOT compliance calendar for the smallest operators on the road.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.heading}>
              <p className="text-sm font-semibold text-white">{col.heading}</p>
              <ul className="mt-4 space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="inline-block py-1 text-sm text-slate-400 transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-8 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-sm text-slate-400">© {year} RigFile. Built for the drivers who do it all.</p>
          <p className="max-w-md text-xs leading-relaxed text-slate-500">
            RigFile is a record-keeping tool for motor-carrier compliance. It is not affiliated with the
            FMCSA or U.S. DOT and does not provide legal advice.
          </p>
        </div>
      </div>
    </footer>
  )
}
