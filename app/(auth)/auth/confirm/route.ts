// CANONICAL — GET /auth/confirm
// Handles every Supabase email link for RigFile: signup confirmation and
// password recovery. Supports both the token_hash+type format (custom email
// templates) and the ?code= PKCE format, so it works no matter how the
// Supabase project templates are configured.
//
// Security notes:
//   - `next` is sanitized to a same-site path — open redirects are impossible.
//   - Failures never leak token details; users get a friendly retry path.

import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function sanitizeNext(raw: string | null, fallback: string): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : fallback
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')

  const fallback = type === 'recovery' ? '/update-password' : '/dashboard'
  const next = sanitizeNext(searchParams.get('next'), fallback)

  const supabase = await createClient()

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(new URL(next, origin))
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, origin))
  }

  const target = type === 'recovery' ? '/forgot-password' : '/login'
  const message =
    type === 'recovery'
      ? 'That reset link has expired or was already used. Send yourself a fresh one below.'
      : 'That confirmation link has expired or was already used. Log in, or sign up again for a new one.'

  return NextResponse.redirect(new URL(`${target}?message=${encodeURIComponent(message)}`, origin))
}
