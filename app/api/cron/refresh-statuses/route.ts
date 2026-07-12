// CANONICAL: /api/cron/refresh-statuses — daily scheduled job endpoint.
// Calls the SECURITY DEFINER function rigfile_refresh_dqf_statuses() (service
// role only) so stored item statuses roll forward as dates pass. Protected by a
// bearer secret, never by user sessions.
//
// Required env var: CRON_SECRET (server-only; the scheduler sends
// 'Authorization: Bearer <CRON_SECRET>'). GET and POST both work so any
// scheduler (Netlify, Vercel, external) can call it.
import { createHash, timingSafeEqual } from 'node:crypto'
import { type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { internalErrorResponse, jsonData, jsonError } from '@/lib/db/api-helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RefreshResponse {
  updated_items: number
  refreshed_at: string
}

async function handleRefresh(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return jsonError(
        'The status refresh job is not configured on this deployment.',
        'NOT_CONFIGURED',
        503
      )
    }

    // Timing-safe secret check (QA-006): hash both sides with SHA-256 so the
    // buffers passed to crypto.timingSafeEqual are always equal length (it
    // throws on mismatched lengths), then compare digests in constant time so
    // the comparison cost never leaks how much of the secret matched.
    const authorizationHeader = request.headers.get('authorization') ?? ''
    const expectedDigest = createHash('sha256').update(`Bearer ${cronSecret}`).digest()
    const providedDigest = createHash('sha256').update(authorizationHeader).digest()
    if (!timingSafeEqual(expectedDigest, providedDigest)) {
      return jsonError('This endpoint is for the scheduled job only.', 'UNAUTHORIZED', 401)
    }

    const admin = createSupabaseAdminClient()
    const { data, error } = await admin.rpc('rigfile_refresh_dqf_statuses')
    if (error) {
      return internalErrorResponse('cron.refresh', error)
    }

    const responseBody: RefreshResponse = {
      updated_items: typeof data === 'number' ? data : 0,
      refreshed_at: new Date().toISOString(),
    }
    return jsonData(responseBody)
  } catch (error) {
    return internalErrorResponse('cron.refresh', error)
  }
}

export async function POST(request: NextRequest) {
  return handleRefresh(request)
}

export async function GET(request: NextRequest) {
  return handleRefresh(request)
}
