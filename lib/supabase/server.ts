// CANONICAL: Server-side Supabase clients for RigFile route handlers, server
// components, and server actions.
//
// Uses @supabase/ssr ONLY. Never import @supabase/auth-helpers-nextjs — the two
// libraries write incompatible cookies and mixing them breaks every session.
//
// Required environment variables (documented for the Deploy Mind):
//   NEXT_PUBLIC_SUPABASE_URL       (client-safe)
//   NEXT_PUBLIC_SUPABASE_ANON_KEY  (client-safe)
//   SUPABASE_SERVICE_ROLE_KEY      (server-only — storage + cron only, never for user data access)
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createBareClient, type SupabaseClient, type User } from '@supabase/supabase-js'

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    // Thrown at request time, never at module load time (build-safe).
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/**
 * Cookie-bound Supabase client. Every user-facing query goes through this client
 * so Row Level Security is ALWAYS enforced with the caller's identity.
 */
export function createSupabaseServerClient(): SupabaseClient {
  const cookieStore = cookies()

  return createServerClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Components cannot set cookies. Session refresh is handled by
            // the middleware — safe to ignore.
          }
        },
      },
    }
  )
}

// ---------------------------------------------------------------------------
// CANONICAL ALIAS — the auth/payments step calls `await createClient()` in
// eleven files (auth routes, /api/checkout, /api/billing/*, /api/auth/me).
// Async wrapper so both `createClient()` and `await createClient()` work.
// ---------------------------------------------------------------------------
export async function createClient(): Promise<SupabaseClient> {
  return createSupabaseServerClient()
}

let adminClient: SupabaseClient | null = null

/**
 * Service-role client. Bypasses RLS. Used ONLY for:
 *  - Supabase Storage operations (signed URLs, uploads of generated PDFs)
 *  - the daily status-refresh cron RPC
 * Never used to read or write user rows on behalf of a request — user-scoped
 * queries always go through createSupabaseServerClient() so RLS stays in force.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  if (adminClient) {
    return adminClient
  }

  adminClient = createBareClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
  return adminClient
}

export interface AuthenticatedContext {
  supabase: SupabaseClient
  user: User
}

/**
 * Resolves the signed-in user with a server-verified check (auth.getUser hits
 * the Supabase Auth server — it never trusts an unverified cookie payload).
 * Returns null when there is no valid session; routes translate that to 401.
 */
export async function getAuthenticatedContext(): Promise<AuthenticatedContext | null> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    return null
  }

  return { supabase, user: data.user }
}
