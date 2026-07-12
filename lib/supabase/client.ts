// CANONICAL: Browser Supabase client for RigFile client components.
// Uses @supabase/ssr ONLY. Never import @supabase/auth-helpers-nextjs (deprecated,
// incompatible cookie format — caused production redirect loops).
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

/**
 * Lazily creates (and memoizes) the browser Supabase client.
 * Lazy so a missing env var never crashes the build — only the request that needs it.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey)
  return browserClient
}

// ---------------------------------------------------------------------------
// CANONICAL ALIAS — the auth step imports { createClient } from this module.
// Without this export the auth pages (login/signup/forgot/update-password)
// fail to compile. Same memoized client, second name.
// ---------------------------------------------------------------------------
export const createClient = createSupabaseBrowserClient
