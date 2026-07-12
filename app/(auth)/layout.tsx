// CANONICAL — shared centered-card layout for all RigFile auth pages
// (/login, /signup, /forgot-password, /update-password).
// Nests inside the root layout owned by the core step, so fonts and global
// styles are inherited. Uses only default Tailwind utilities — no dependency
// on custom theme tokens that another step may or may not define.

import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Your account — RigFile',
  description:
    'Log in or create your RigFile account to track all 18 DQF items and stay DOT audit-ready.',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 sm:py-16">
      {/* Ambient amber glow + a single highway line. Decorative only. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
      </div>

      <Link
        href="/"
        aria-label="RigFile home"
        className="relative z-10 mb-8 flex items-center gap-2.5 transition-opacity hover:opacity-90"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20">
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </span>
        <span className="text-2xl font-bold tracking-tight text-white">
          Rig<span className="text-amber-400">File</span>
        </span>
      </Link>

      <main className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-black/40 ring-1 ring-white/10 sm:p-8">
          {children}
        </div>
        <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
          All 18 DQF items on one calendar · Audit-ready PDF in one click · Built for owner-operators
        </p>
      </main>
    </div>
  )
}
