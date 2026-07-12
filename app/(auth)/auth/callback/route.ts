// CANONICAL — GET /auth/callback
// OAuth (Google / GitHub) return leg: exchanges the PKCE code for a session
// and drops the driver on their dashboard. The database trigger
// rigfile_handle_new_user provisions the profile + free subscription on first
// OAuth sign-in, so there is zero extra onboarding.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function sanitizeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard'
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const providerError = searchParams.get('error_description') || searchParams.get('error')
  const next = sanitizeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, origin))
  }

  const message = providerError
    ? 'The sign-in provider sent us back an error. Try again, or use your email and password instead.'
    : 'We couldn’t finish signing you in. Give it another try.'

  return NextResponse.redirect(new URL(`/login?message=${encodeURIComponent(message)}`, origin))
}
