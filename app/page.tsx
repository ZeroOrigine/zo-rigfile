// CANONICAL: app/page.tsx — RigFile marketing landing page (hero, audience strip, features, how-it-works, pricing, moments, FAQ, final CTA, footer)
// SELF-VALIDATION FIX: literal \u-escape sequences in JSX text replaced with real
// characters, and all plan/reminder claims aligned to enforced behavior (in-app
// warnings with a configurable window; audit PDFs are a Solo/Fleet feature).
import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingNav from '@/components/marketing/nav'
import PricingSection from '@/components/marketing/pricing-section'
import Reveal from '@/components/marketing/reveal'

export const metadata: Metadata = {
  title: 'RigFile — DOT Compliance Calendar for Owner-Operator Truckers',
  description:
    'RigFile tracks all 18 driver qualification file (DQF) items, warns you before anything expires, and generates an audit-ready PDF in seconds. Built for owner-operators and small fleets — free forever for one driver.',
  keywords: [
    'DQF tracking',
    'driver qualification file',
    'DOT compliance',
    'owner operator compliance',
    'FMCSA 391.51',
    'DOT audit preparation',
    'med card expiration tracker',
    'trucking compliance software',
  ],
  openGraph: {
    title: 'RigFile — Never hand a DOT auditor an expired document again',
    description:
      'Track all 18 DQF items, get warned before anything lapses, and export an audit-ready PDF in seconds. Free forever for one driver.',
    type: 'website',
    url: '/',
    siteName: 'RigFile',
  },
  twitter: {
    card: 'summary',
    title: 'RigFile — DOT Compliance Calendar for Owner-Operators',
    description:
      'All 18 DQF items tracked. Audit-ready PDF in seconds. Free forever for one driver.',
  },
  alternates: { canonical: '/' },
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

function IconCalendar({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  )
}

function IconBell({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function IconFile({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8" />
    </svg>
  )
}

function IconShield({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function IconClip({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

function IconAlert({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
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

const FEATURES = [
  {
    icon: IconCalendar,
    title: 'All 18 items. One calendar.',
    desc: 'Med card, CDL, annual MVR review, Certificate of Violations, Clearinghouse query — every dated item in your qualification file, each with a live countdown.',
  },
  {
    icon: IconBell,
    title: 'Warned before it costs you.',
    desc: 'Statuses flip from green to amber inside your warning window — 30 days by default, tunable from 1 to 365 — and the dashboard ranks what to fix first. A renewal you could do next week should never become a $1,270+ violation.',
  },
  {
    icon: IconFile,
    title: 'An audit PDF in one tap.',
    desc: 'DOT auditor, safety investigator, insurance underwriter — when someone wants your file, export a clean, dated, organized packet in seconds instead of digging through the cab.',
  },
  {
    icon: IconTruck,
    title: 'Built for one driver first.',
    desc: 'RigFile was never fleet software with the seats stripped out. Every screen assumes you are the driver, the safety manager, and the back office — because you are.',
  },
  {
    icon: IconShield,
    title: 'New-entrant audit ready.',
    desc: 'Running on new authority? The FMCSA safety audit lands inside your first 12 months. Walk in with a complete, organized file instead of a shoebox of receipts.',
  },
  {
    icon: IconClip,
    title: 'Every document, attached.',
    desc: 'Snap a photo of the paper copy and it is filed with the right item and the right date — so the packet you hand over is complete, not just a checklist.',
  },
]

const STEPS = [
  {
    title: 'Enter your dates',
    desc: 'List each of the 18 DQF items with its expiration or review date — med card, CDL, MVR review, all of it. One sitting, about ten minutes, from your phone or laptop.',
  },
  {
    title: 'Let the calendar watch',
    desc: 'Every item gets a live countdown: green when you\u2019re clear, amber inside your warning window (30 days out of the box), red when something needs action now. Your dashboard flags trouble before deadlines do.',
  },
  {
    title: 'Print your proof',
    desc: 'Auditor, officer, or underwriter asks? Generate a dated, organized, audit-ready PDF of your entire file in seconds — from the cab, the office, or the scale house.',
  },
]

const MOMENTS = [
  {
    icon: IconShield,
    title: 'The new-entrant audit',
    story:
      'Eight months under your own authority, and the FMCSA safety-audit notice lands in your inbox. Instead of losing a weekend to a shoebox of paperwork, you export one organized packet and get back to booking loads.',
    fact: 'New-entrant safety audits happen within your first 12 months of authority.',
  },
  {
    icon: IconTruck,
    title: 'The roadside inspection',
    story:
      'An officer works through the truck, then asks about your medical certificate. You already know the answer — RigFile flagged it three weeks out, and you renewed it last Tuesday.',
    fact: 'Driver-qualification checks are a routine part of inspections.',
  },
  {
    icon: IconFile,
    title: 'The insurance renewal',
    story:
      'Your agent wants proof your qualification file is current before quoting the year. One PDF, sixty seconds, sent — while the other guy is still digging through the glovebox.',
    fact: 'Carriers and underwriters can ask to see your file, too.',
  },
]

const FAQS = [
  {
    q: 'What exactly is a driver qualification file?',
    a: 'Federal rule 49 CFR \u00A7391.51 requires every CDL driver — including owner-operators driving for themselves — to keep a qualification file: employment application, CDL copy, medical examiner\u2019s certificate, annual MVR reviews, Certificate of Violations, road-test certificate, Clearinghouse queries, and more. Counting every dated item and renewal, that\u2019s 18 things to keep current. RigFile tracks all of them.',
  },
  {
    q: 'Is the free plan actually free, or a trial?',
    a: 'Free forever — no credit card, no expiration date. You get one driver file, all 18 items, and the color-coded compliance calendar with a warning window before anything lapses. You pay only when you want unlimited audit-ready PDF exports (Solo, $29/mo) or more drivers (Fleet, $99/mo).',
  },
  {
    q: 'Will the PDF actually work in a DOT audit?',
    a: 'RigFile organizes your file the way auditors check it — item by item against \u00A7391.51, with every date front and center. You still need the underlying documents to be genuine and current; RigFile\u2019s job is making sure they are, and proving it cleanly. It\u2019s a record-keeping tool, not legal advice.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. Your records are encrypted in transit and at rest, isolated to your account with row-level security, and never sold or shared. You can export or permanently delete everything whenever you want.',
  },
  {
    q: 'Can I get my data out?',
    a: 'Anytime, on every plan. Export the audit PDF or download your dates and records. It\u2019s your file — RigFile just keeps it current.',
  },
  {
    q: 'Do I need to connect an ELD or install anything?',
    a: 'No. RigFile is deliberately standalone — it runs in the browser on your phone or laptop, with nothing wired into your ELD or dispatch software. Enter your dates once and you\u2019re covered. And if you get stuck, email support is included on every plan, answered by people.',
  },
]

/* ---------------------------------- Page ---------------------------------- */

export default function HomePage() {
  return (
    <div className="bg-white dark:bg-slate-950">
      <MarketingNav />
      <main>
        <Hero />
        <AudienceStrip />
        <Features />
        <HowItWorks />
        <PricingSection />
        <Moments />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
      <style>{`
@keyframes rf-rise {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
}
.rf-rise { animation: rf-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
.rf-d1 { animation-delay: 0.08s; }
.rf-d2 { animation-delay: 0.16s; }
.rf-d3 { animation-delay: 0.26s; }
.rf-d4 { animation-delay: 0.38s; }
@media (prefers-reduced-motion: reduce) {
  .rf-rise { animation: none; }
}
`}</style>
    </div>
  )
}

/* ---------------------------------- Hero ---------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden bg-slate-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_-10%,rgba(245,158,11,0.16),transparent)]"
      />
      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8 lg:pb-28 lg:pt-24">
        <div className="max-w-xl">
          <p className="rf-rise inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 ring-1 ring-inset ring-amber-500/30">
            <IconAlert className="h-3.5 w-3.5" />
            $1,270+ — the fine one expired document can draw
          </p>
          <h1 className="rf-rise rf-d1 mt-6 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Never hand a DOT auditor an <span className="text-amber-400">expired document</span> again.
          </h1>
          <p className="rf-rise rf-d2 mt-6 text-lg leading-relaxed text-slate-300">
            RigFile tracks all 18 driver-qualification-file items for owner-operators, warns you weeks
            before anything lapses, and prints an audit-ready PDF the second someone asks. Not fleet
            software with the seats stripped out — built for one driver from day one.
          </p>
          <div className="rf-rise rf-d3 mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-amber-500 px-6 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition-colors hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            >
              Get Started Free
              <IconArrow />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-white/20 px-6 py-3 text-base font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/5"
            >
              See how it works
            </a>
          </div>
          <p className="rf-rise rf-d3 mt-4 text-sm text-slate-400">
            Free forever for one driver. No credit card. About 10 minutes to set up.
          </p>
          <div className="rf-rise rf-d4 mt-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
            {[
              { value: '18 / 18', label: 'DQF items tracked' },
              { value: 'Seconds', label: 'to an audit-ready PDF' },
              { value: '\u00A7391.51', label: 'the checklist we mirror' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-display text-2xl font-bold text-white">{stat.value}</p>
                <p className="mt-1 text-xs leading-snug text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rf-rise rf-d2 mt-16 lg:mt-0">
          <HeroMockup />
        </div>
      </div>
    </section>
  )
}

function HeroMockup() {
  const rows: { name: string; status: string; tone: 'amber' | 'green' | 'red' }[] = [
    { name: 'Medical Examiner\u2019s Certificate', status: '21 days left', tone: 'amber' },
    { name: 'CDL — Class A', status: 'Current', tone: 'green' },
    { name: 'Certificate of Violations', status: 'Overdue', tone: 'red' },
    { name: 'Annual MVR Review', status: 'Current', tone: 'green' },
    { name: 'Clearinghouse Query', status: 'Current', tone: 'green' },
  ]
  const dot: Record<string, string> = {
    amber: 'bg-amber-400',
    green: 'bg-emerald-400',
    red: 'bg-red-400',
  }
  const pill: Record<string, string> = {
    amber: 'bg-amber-400/10 text-amber-300 ring-amber-400/30',
    green: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30',
    red: 'bg-red-400/10 text-red-300 ring-red-400/30',
  }

  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div aria-hidden="true" className="absolute -inset-8 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Driver Qualification File</p>
            <p className="mt-1 font-display text-lg font-bold text-white">Your DQF at a glance</p>
          </div>
          <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300 ring-1 ring-inset ring-amber-500/30">
            2 need attention
          </span>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>18 of 18 items tracked</span>
            <span className="font-semibold text-emerald-400">100%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500" />
          </div>
        </div>

        <ul className="mt-5 space-y-2.5">
          {rows.map((row) => (
            <li
              key={row.name}
              className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2.5 ring-1 ring-inset ring-white/5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={`h-2 w-2 flex-none rounded-full ${dot[row.tone]}`} />
                <span className="truncate text-sm font-medium text-slate-200">{row.name}</span>
              </div>
              <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${pill[row.tone]}`}>
                {row.status}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5 border-t border-white/10 pt-5">
          <Link
            href="/signup"
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
          >
            <IconFile className="h-4 w-4" />
            Generate Audit PDF
          </Link>
          <p className="mt-2.5 text-center text-[11px] text-slate-500">
            Sample file — yours takes about 10 minutes to set up.
          </p>
        </div>
      </div>

      <div className="absolute -top-4 right-2 hidden rotate-1 items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 shadow-xl sm:flex">
        <IconBell className="h-4 w-4 text-amber-400" />
        <p className="text-xs font-medium text-slate-200">
          Heads up — Med card: <span className="text-amber-300">21 days left</span>
        </p>
      </div>
      <div className="absolute -bottom-4 left-2 hidden -rotate-1 items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 shadow-xl sm:flex">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
          <IconCheck className="h-3 w-3" />
        </span>
        <p className="text-xs font-medium text-slate-200">audit-packet.pdf — generated</p>
      </div>
    </div>
  )
}

/* ----------------------------- Audience strip ------------------------------ */

function AudienceStrip() {
  const audiences = [
    'Owner-Operators',
    'Hotshot Haulers',
    'Expediters',
    'Box-Truck Operators',
    'Small Fleets (1\u201310 trucks)',
  ]
  return (
    <section aria-label="Who RigFile is built for" className="border-b border-slate-200 bg-white py-10 dark:border-white/10 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          Built for the smallest operators on the road
        </p>
        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {audiences.map((audience) => (
            <li key={audience} className="text-sm font-semibold text-slate-400 dark:text-slate-500">
              {audience}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* -------------------------------- Features -------------------------------- */

function Features() {
  return (
    <section id="features" className="scroll-mt-20 bg-white py-20 sm:py-24 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">Why RigFile</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Fleet-grade audit protection, sized for one truck.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            Big fleets have compliance departments. You have RigFile — and ten minutes at a truck stop is all it takes.
          </p>
        </Reveal>
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon
            return (
              <Reveal key={feature.title} delay={(i % 3) * 90} className="h-full">
                <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-lg dark:border-white/10 dark:bg-slate-900/40">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold text-slate-900 dark:text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{feature.desc}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------- How it works ------------------------------ */

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-slate-50 py-20 sm:py-24 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">How it works</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Ten minutes now. Covered all year.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            No integrations, no imports, no training videos. If you can fill out a logbook, you can set up RigFile.
          </p>
        </Reveal>
        <div className="relative mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
          <div
            aria-hidden="true"
            className="absolute left-[16%] right-[16%] top-7 hidden border-t-2 border-dashed border-slate-300 md:block dark:border-white/10"
          />
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 120} className="text-center">
              <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 font-display text-xl font-bold text-slate-950 ring-8 ring-slate-50 dark:ring-slate-900">
                {i + 1}
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-slate-900 dark:text-white">{step.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-600 dark:text-slate-300">{step.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* --------------------------------- Moments --------------------------------- */

function Moments() {
  return (
    <section className="bg-slate-50 py-20 sm:py-24 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">The moments</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            You already know the days this is for.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            RigFile exists for the days you hope won’t come — and the ones already on the calendar.
          </p>
        </Reveal>
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {MOMENTS.map((moment, i) => {
            const Icon = moment.icon
            return (
              <Reveal key={moment.title} delay={i * 100} className="h-full">
                <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-950/50">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold text-slate-900 dark:text-white">{moment.title}</h3>
                  <p className="mt-3 border-l-2 border-amber-500 pl-4 text-sm italic leading-relaxed text-slate-600 dark:text-slate-300">
                    {moment.story}
                  </p>
                  <p className="mt-4 text-xs font-medium text-slate-400 dark:text-slate-500">{moment.fact}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------- FAQ ----------------------------------- */

function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 bg-white py-20 sm:py-24 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">FAQ</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Straight answers.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            The things owner-operators actually ask.
          </p>
        </Reveal>
        <div className="mt-10 space-y-3">
          {FAQS.map((faq) => (
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
  )
}

/* -------------------------------- Final CTA -------------------------------- */

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-slate-950 py-20 sm:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_100%,rgba(245,158,11,0.14),transparent)]"
      />
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
          Be audit-ready before anyone asks.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
          Somewhere on your calendar, something is quietly expiring. Ten minutes tonight puts all 18
          items where you can see them — with a clean PDF one tap away.
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
        <p className="mt-4 text-sm text-slate-400">No credit card required. Free plan forever — not a trial.</p>
      </div>
    </section>
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
