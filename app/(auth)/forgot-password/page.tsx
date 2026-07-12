'use client'

// CANONICAL — RigFile /forgot-password page. Sends a Supabase recovery email
// that lands on /auth/confirm?next=/update-password. Always responds with a
// generic success message so the form never leaks whether an email exists.

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !email.includes('@')) {
      setError('Hmm, that email doesn’t look quite right. Mind checking it?')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=/update-password`,
    })
    if (resetError) {
      const msg = (resetError.message || '').toLowerCase()
      if (msg.includes('rate limit') || msg.includes('too many')) {
        setError('Too many requests. Take a breather and try again in a minute.')
      } else {
        setError('We couldn’t send the reset link just now. Give it another try in a moment.')
      }
      setLoading(false)
      return
    }
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <svg className="h-7 w-7 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m4 7 8 6 8-6" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Reset link on its way</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          If <span className="font-semibold text-slate-900">{email.trim()}</span> has a RigFile account,
          a password reset link will land there in the next minute or two. It stays good for about an hour.
        </p>
        <p className="mt-6">
          <Link href="/login" className="text-sm font-semibold text-amber-600 transition-colors hover:text-amber-700">
            Back to log in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reset your password</h1>
      <p className="mt-1.5 text-sm text-slate-600">
        Enter your email and we’ll send you a reset link. You’ll be back on the road in two minutes.
      </p>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourauthority.com"
            className={`${inputClass} mt-1.5`}
          />
        </div>

        <button type="submit" disabled={loading} className={primaryBtn}>
          {loading ? (
            <>
              <Spinner />
              <span className="ml-2">Sending…</span>
            </>
          ) : (
            'Send reset link'
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-amber-600 transition-colors hover:text-amber-700">
          Log in
        </Link>
      </p>
    </div>
  )
}
