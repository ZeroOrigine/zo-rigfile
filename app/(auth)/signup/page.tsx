'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Enter your email address.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()

      // Only the error is inspected. We deliberately do NOT look at
      // data.user.identities: whether this email is brand new or already
      // registered, the caller sees the exact same generic success state,
      // so the signup form cannot be used to probe which emails have
      // RigFile accounts (matches the login / forgot-password flows).
      const { error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      })

      if (signUpError) {
        const message = signUpError.message.toLowerCase()

        // Non-enumeration: never reveal whether an account already exists.
        // Supabase can surface "User already registered" style errors when
        // email confirmations are disabled — fold those into the same
        // generic "check your email" success state.
        if (
          message.includes('already registered') ||
          message.includes('already been registered') ||
          message.includes('already exists')
        ) {
          setSubmitted(true)
          return
        }

        if (signUpError.status === 429) {
          setError('Too many attempts. Wait a minute and try again.')
          return
        }

        // Password-policy feedback does not disclose account existence.
        if (message.includes('password')) {
          setError(signUpError.message)
          return
        }

        setError('Something went wrong. Please try again.')
        return
      }

      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="w-full">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <svg
              className="h-6 w-6 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Check your email to continue
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            We sent a message to{' '}
            <span className="font-medium text-zinc-900">{email.trim()}</span>.
            If that address can be used for a RigFile account, it contains a
            link to finish signing up.
          </p>
          <p className="mt-4 text-sm text-zinc-600">
            Didn&apos;t get anything? Check your spam folder, or{' '}
            <button
              type="button"
              onClick={() => {
                setSubmitted(false)
                setPassword('')
                setError(null)
              }}
              className="font-medium text-amber-700 underline underline-offset-2 hover:text-amber-600"
            >
              try a different email
            </button>
            .
          </p>
          <p className="mt-6 text-sm text-zinc-600">
            Already confirmed?{' '}
            <Link
              href="/login"
              className="font-medium text-amber-700 hover:text-amber-600"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">
          Create your RigFile account
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Track all 18 DQF items and stay audit-ready.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-zinc-700"
          >
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
            placeholder="you@example.com"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-zinc-700"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-600">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-amber-700 hover:text-amber-600"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
