// CANONICAL — POST /auth/signout
// Sign-out is POST-only on purpose: a stray <a href> or prefetched GET can
// never log a driver out (CSRF-safe by design, on top of SameSite cookies).
// The dashboard (core step) triggers this with:
//   <form method="post" action="/auth/signout"><button>Log out</button></form>

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const message = encodeURIComponent('You’re signed out. Drive safe out there.')
  return NextResponse.redirect(new URL(`/login?message=${message}`, request.url), { status: 303 })
}

export async function GET() {
  return NextResponse.json(
    { error: 'Use POST to sign out — GET is ignored so a stray link can never log you out.' },
    { status: 405 }
  )
}
