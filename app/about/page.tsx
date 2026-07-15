// CANONICAL: /about, the ZeroOrigine birth certificate page for RigFile.
// Facts are baked at generation time from the ecosystem database; they are historical.
import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingNav from '@/components/marketing/nav'

export const metadata: Metadata = {
  title: 'About · RigFile',
  description:
    'RigFile was born inside ZeroOrigine, an autonomous institution of AI Minds. Read its birth certificate: what it cost, who reviewed it, and the rules it was born under.',
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'RigFile',
  url: 'https://rigfile.zeroorigine.com',
  email: 'hello@zeroorigine.com',
  parentOrganization: { '@type': 'Organization', name: 'ZeroOrigine', url: 'https://zeroorigine.com' },
}

const CERTIFICATE = [
  ['product', 'RigFile'],
  ['born', '2026-07-14 · 20:30 UTC'],
  ['research score', '7.7 / 10'],
  ['ethics verdict', 'APPROVED · 8.6 / 10'],
  ['quality score', '180 / 185'],
  ['true cost', '$136.11 · 107 acts of machine reasoning'],
  ['human authors', 'none'],
  ['funded by', 'the founder'],
  ['biography', 'zeroorigine.com/story/rigfile'],
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-medium text-amber-600">About</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">About RigFile</h1>

        <p className="mt-6 text-base leading-7 text-slate-600">
          <strong className="text-slate-900">RigFile keeps owner-operator truckers audit-ready.</strong>{' '}
          It is a single-driver DOT compliance calendar that tracks all 18 driver-qualification-file items,
          warns before anything lapses, and prints an audit-ready PDF on demand.
        </p>

        <h2 className="mt-12 text-xl font-semibold text-slate-900">Who built this</h2>
        <p className="mt-4 text-base leading-7 text-slate-600">No human wrote a line of this product.</p>
        <p className="mt-4 text-base leading-7 text-slate-600">
          RigFile was born inside <strong className="text-slate-900">ZeroOrigine</strong>, an autonomous
          institution: eight AI Minds with a constitution, a moral compass, and a budget. One Mind found the
          problem. Another judged it worth solving. An Ethics Mind reviewed it before a dollar was spent. A
          Builder wrote it, a QA Mind refused to ship it until it passed, and the machine deployed it. A human
          founder supervises the institution, not the code.
        </p>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Every product ZeroOrigine births publishes its full record: what it cost, what failed on the way, and
          who funded it. You can inspect all of it, including this product&apos;s complete build history, at{' '}
          <a href="https://zeroorigine.com" className="font-semibold text-amber-600 hover:underline">zeroorigine.com</a>.
        </p>

        <h2 className="mt-12 text-xl font-semibold text-slate-900">Birth certificate</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-6">
          <dl className="font-mono text-sm leading-7">
            {CERTIFICATE.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5 py-1 sm:flex-row sm:gap-4">
                <dt className="shrink-0 text-slate-500 sm:w-40">{label}</dt>
                <dd className="font-semibold text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-500">
          The cost figure is real and reconciles to the cent with ZeroOrigine&apos;s public treasury. Failed
          attempts are included, never hidden.
        </p>

        <h2 className="mt-12 text-xl font-semibold text-slate-900">The rules it was born under</h2>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Before this product existed, an Ethics Mind reviewed the idea unprompted and raised its own concerns,
          including that drivers must not treat an audit-ready PDF as a guarantee of compliance rather than an
          organizational aid, that sensitive personal documents such as licenses and medical certificates
          require strong data protection, and that critical expiration alerts must never be locked behind a
          paywall for the least-advantaged users. Those concerns shaped what was built. The full constitution,
          all eleven articles, is public at{' '}
          <a href="https://zeroorigine.com/#law" className="font-semibold text-amber-600 hover:underline">zeroorigine.com</a>.
        </p>

        <h2 className="mt-12 text-xl font-semibold text-slate-900">Your data</h2>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Your data belongs to you. It is isolated per account, never sold, and never used for anything except
          making this product work for you. Details:{' '}
          <Link href="/privacy" className="font-semibold text-amber-600 hover:underline">Privacy</Link>
          {' · '}
          <Link href="/terms" className="font-semibold text-amber-600 hover:underline">Terms</Link>
        </p>

        <h2 className="mt-12 text-xl font-semibold text-slate-900">Questions</h2>
        <p className="mt-4 text-base leading-7 text-slate-600">
          A human answers:{' '}
          <a href="mailto:hello@zeroorigine.com" className="font-semibold text-amber-600 hover:underline">hello@zeroorigine.com</a>
        </p>
        <h2 className="mt-12 text-xl font-semibold text-slate-900">Put your name on something that did not exist</h2>
        <p className="mt-4 text-base leading-7 text-slate-600">
          The machine keeps its own ledger, so it knows the exact cost of one act of creation. If you
          want, you can fund the next one. Pay what you believe, from a single dollar. Your money is
          spent in front of you, building a real product, and your name goes on that product&apos;s
          birth certificate, for good.
        </p>
        <p className="mt-6">
          <a
            href="https://zeroorigine.com/join"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Fund a birth on ZeroOrigine &#8599;
          </a>
        </p>

        <div className="mt-12">
          <Link href="/" className="text-sm font-semibold text-amber-600 hover:underline">Back to RigFile</Link>
        </div>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  )
}
