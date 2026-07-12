// Alias route — the canonical browser flow lives at app/(auth)/auth/callback
// (/auth/callback). This /api/auth/callback twin exists because platform
// tooling and older Supabase templates expect the /api/auth/callback path.
// Both are safe to whitelist in Supabase redirect URLs.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function sanitizeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard'
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = sanitizeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, origin))
  }

  return NextResponse.redirect(
    new URL(`/login?message=${encodeURIComponent('We couldn’t finish signing you in. Give it another try.')}`, origin)
  )
}
