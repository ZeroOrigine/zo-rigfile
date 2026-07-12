'use client'

// CANONICAL — RigFile /update-password page. The recovery email lands on
// /auth/confirm, which verifies the token and redirects here with a live
// session. This page then sets the new password via supabase.auth.updateUser.

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const inputClass =
  'block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30'
const primaryBtn =
  'flex w-full items-center justify-center rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition-all hover:bg-amber-400 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-60'

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export default function UpdatePasswordPage() {
  const router = useRouter()

  const [sessionChecked, setSessionChecked] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(Boolean(data.user))
      setSessionChecked(true)
    })
  }, [])

  const pwLongEnough = password.length >= 8
  const pwMatch = confirm.length > 0 && password === confirm

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (!pwLongEnough) {
      setError('Your new password needs at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Those two passwords don’t match. Type them again carefully.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      const msg = (updateError.message || '').toLowerCase()
      if (msg.includes('session')) {
        setHasSession(false)
      } else if (msg.includes('different from the old')) {
        setError('That’s your current password. Pick something new.')
      } else {
        setError('We couldn’t update your password just now. Give it one more try.')
      }
      setLoading(false)
      return
    }
    setDone(true)
    setLoading(false)
    setTimeout(() => {
      router.push('/dashboard')
      router.refresh()
    }, 1400)
  }

  if (!sessionChecked) {
    return (
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-7 w-2/5 rounded bg-slate-200" />
        <div className="h-4 w-3/5 rounded bg-slate-100" />
        <div className="h-11 rounded-lg bg-slate-100" />
        <div className="h-11 rounded-lg bg-slate-100" />
        <div className="h-11 rounded-lg bg-slate-200" />
      </div>
    )
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-7 w-7 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Password updated</h1>
        <p className="mt-2 text-sm text-slate-600">You’re set. Rolling you to your dashboard…</p>
        <p className="mt-6">
          <Link href="/dashboard" className="text-sm font-semibold text-amber-600 transition-colors hover:text-amber-700">
            Go there now
          </Link>
        </p>
      </div>
    )
  }

  if (!hasSession) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <svg className="h-7 w-7 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">That link has expired</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Password reset links are single-use and expire after about an hour.
          Grab a fresh one and you’ll be back in shortly.
        </p>
        <Link href="/forgot-password" className={`${primaryBtn} mt-6`}>
          Send me a new link
        </Link>
        <p className="mt-4">
          <Link href="/login" className="text-sm font-semibold text-amber-600 transition-colors hover:text-amber-700">
            Back to log in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Set a new password</h1>
      <p className="mt-1.5 text-sm text-slate-600">Make it at least 8 characters — then you’re back on the road.</p>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            New password
          </label>
          <div className="relative mt-1.5">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={`${inputClass} pr-16`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:text-slate-700"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <p
            className={`mt-1.5 flex items-center gap-1.5 text-xs transition-colors ${
              password.length === 0 ? 'text-slate-400' : pwLongEnough ? 'text-emerald-600' : 'text-slate-500'
            }`}
          >
            <span aria-hidden="true">{pwLongEnough ? '✓' : '•'}</span> At least 8 characters
          </p>
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-slate-700">
            Type it again
          </label>
          <input
            id="confirm"
            name="confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Same password again"
            className={`${inputClass} mt-1.5`}
          />
          {confirm.length > 0 ? (
            <p className={`mt-1.5 flex items-center gap-1.5 text-xs ${pwMatch ? 'text-emerald-600' : 'text-slate-500'}`}>
              <span aria-hidden="true">{pwMatch ? '✓' : '•'}</span> Passwords match
            </p>
          ) : null}
        </div>

        <button type="submit" disabled={loading} className={primaryBtn}>
          {loading ? (
            <>
              <Spinner />
              <span className="ml-2">Updating…</span>
            </>
          ) : (
            'Update password'
          )}
        </button>
      </form>
    </div>
  )
}
