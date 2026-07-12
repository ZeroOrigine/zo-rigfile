'use client'

// CANONICAL: Dashboard shell for RigFile — sidebar navigation, mobile drawer,
// plan chip, sign-out, and the global toast viewport. Route protection is
// handled by middleware (auth step) plus 401 redirects in lib/core/api.
import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
// QA-007/QA-024: ProfileProvider (mounted below) owns the single
// /api/profile load for the whole dashboard; the shell and pages such as
// drivers/[id] and audit-files consume it via useProfile() instead of
// issuing their own apiFetch('/api/profile') calls.
import { ProfileProvider, useProfile } from './profile-context'
import {
  TOAST_EVENT,
  type ProfileResponse,
  type ToastDetail,
  type ToastTone,
} from '@/lib/core/api'

interface Toast {
  id: number
  message: string
  tone: ToastTone
}

interface NavItem {
  href: string
  label: string
  icon: ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5M5.5 9.8V20h13V9.8" />
      </svg>
    ),
  },
  {
    href: '/audit-files',
    label: 'Audit PDFs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 3h6l4 4v14H8zM14 3v4h4M10.5 12.5h5M10.5 16h5" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.58 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09A1.7 1.7 0 0 0 10.13 3V3a2 2 0 1 1 4 0v.09c0 .66.39 1.26 1.03 1.56.6.27 1.32.14 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09c.3.64.9 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.09c-.66 0-1.26.39-1.51 1.02Z" />
      </svg>
    ),
  },
  {
    href: '/billing',
    label: 'Billing',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <rect x="3" y="5.5" width="18" height="13" rx="2" />
        <path strokeLinecap="round" d="M3 10h18M7 15h4" />
      </svg>
    ),
  },
]

function RigFileMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8.3 7.5 9.9 4.3-1.6 7.5-5.3 7.5-9.9v-6L12 2.5Z"
        fill="#1d4ed8"
      />
      <path d="m8.4 12 2.5 2.5 4.7-4.8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// QA-024: normalize whatever ProfileProvider loaded from /api/profile into
// the { profile, entitlements } account shape the chrome renders. The shared
// context may hand back the full response object or a bare profile row, so
// probe defensively (and synthesize a plan chip from a bare row's `plan`).
function toAccount(value: unknown): ProfileResponse | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (record.profile && typeof record.profile === 'object') {
    return record as unknown as ProfileResponse
  }
  if (typeof record.plan === 'string') {
    const plan = record.plan
    const label = `${plan.charAt(0).toUpperCase()}${plan.slice(1)}`
    return { profile: record, entitlements: { plan, label } } as unknown as ProfileResponse
  }
  return { profile: record } as unknown as ProfileResponse
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  // QA-024: mount the shared ProfileProvider exactly once so every dashboard
  // page (drivers/[id], audit-files, settings, billing) can read the single
  // /api/profile load through useProfile() instead of re-fetching it.
  return (
    <ProfileProvider>
      <DashboardShell>{children}</DashboardShell>
    </ProfileProvider>
  )
}

function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  // QA-024: consume the shared context instead of a direct apiFetch call —
  // ProfileProvider owns the fetch, error, and loading state.
  const { profile: profileRecord } = useProfile()
  const account = toAccount(profileRecord)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    function onToast(event: Event) {
      const detail = (event as CustomEvent<ToastDetail>).detail
      if (!detail?.message) return
      const id = Date.now() + Math.random()
      setToasts((previous) => [...previous.slice(-3), { id, message: detail.message, tone: detail.tone }])
      window.setTimeout(() => {
        setToasts((previous) => previous.filter((toast) => toast.id !== id))
      }, 6000)
    }
    window.addEventListener(TOAST_EVENT, onToast)
    return () => window.removeEventListener(TOAST_EVENT, onToast)
  }, [])

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  function isActive(href: string): boolean {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname.startsWith('/drivers')
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await createSupabaseBrowserClient().auth.signOut()
    } catch {
      // Even if the client can't initialize, send the user to login.
    }
    window.location.assign('/login')
  }

  const plan = account?.entitlements
  const displayName = account?.profile.full_name || account?.profile.email || 'Operator'

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-6 pt-6">
        <RigFileMark className="h-8 w-8" />
        <div>
          <p className="font-display text-lg font-extrabold leading-none text-white">RigFile</p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">DQF compliance</p>
        </div>
      </div>

      <nav aria-label="Main navigation" className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                active ? 'bg-blue-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="space-y-3 px-4 pb-5">
        {plan ? (
          plan.plan === 'free' ? (
            <Link
              href="/billing"
              className="block rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 transition-colors hover:bg-amber-500/20"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-amber-300">Free plan</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Calendar only. Unlock audit-ready PDFs →
              </p>
            </Link>
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-400">{plan.label} plan</p>
              <p className="mt-1 text-xs text-slate-400">
                {plan.plan === 'fleet' ? 'Up to 10 drivers covered' : 'Audit PDFs unlocked'}
              </p>
            </div>
          )
        ) : (
          <div className="skeleton h-14 rounded-xl opacity-30" />
        )}

        <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-4">
          <p className="truncate text-xs font-medium text-slate-400" title={displayName}>
            {displayName}
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H4m0 0 3.5-3.5M4 12l3.5 3.5M11 4h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7" />
            </svg>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-blue-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-slate-900 md:block" aria-label="Sidebar">
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <RigFileMark className="h-7 w-7" />
          <span className="font-display text-base font-extrabold text-slate-900">RigFile</span>
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={drawerOpen}
          className="rounded-lg p-2 text-slate-700 transition-colors hover:bg-slate-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" aria-hidden="true">
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-slate-900 shadow-2xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      <main id="main" className="md:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10 lg:px-8">{children}</div>
      </main>

      {/* Toast viewport */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl animate-toast-in ${
              toast.tone === 'success' ? 'bg-emerald-600' : toast.tone === 'error' ? 'bg-red-600' : 'bg-slate-800'
            }`}
          >
            <span aria-hidden="true" className="mt-0.5 shrink-0">
              {toast.tone === 'success' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                </svg>
              ) : toast.tone === 'error' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4">
                  <path strokeLinecap="round" d="M12 8v5m0 3.5v.5" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4">
                  <path strokeLinecap="round" d="M12 11v5m0-8.5v.5" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              )}
            </span>
            <p className="flex-1 leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToasts((previous) => previous.filter((t) => t.id !== toast.id))}
              aria-label="Dismiss notification"
              className="shrink-0 rounded p-0.5 text-white/70 transition-colors hover:text-white"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
