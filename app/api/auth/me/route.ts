// CANONICAL — GET /api/auth/me
// Small, stable identity endpoint for client components and (later) third-party
// integrations: returns the authenticated user plus their RigFile profile.
// Reads rigfile_profiles under RLS — a user can only ever see their own row.
//
// Rate limiting note: cheap read, but still apply the standard per-user edge
// limit (~60 req/min) to keep abuse boring.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ user: null, error: 'Not logged in.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('rigfile_profiles')
      .select('id, email, full_name, company_name, dot_number, mc_number, timezone, reminder_lead_days, role')
      .eq('id', user.id)
      .maybeSingle()

    return NextResponse.json({
      user: { id: user.id, email: user.email ?? null },
      profile: profile ?? null,
    })
  } catch (err) {
    console.error('[rigfile:auth/me] Unexpected error', err)
    return NextResponse.json(
      { error: 'We couldn’t load your account just now. Refresh and try again.' },
      { status: 500 }
    )
  }
}
