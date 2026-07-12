// CANONICAL: Session-refresh helper for the root middleware.
// The root middleware.ts (owned by the auth step) imports updateSession() from
// here — this file never defines route protection rules itself.
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'

export interface UpdatedSessionResult {
  response: NextResponse
  user: User | null
}

/**
 * Refreshes the Supabase auth session cookies for the current request.
 * Must be called before any route protection decision so expired access tokens
 * are rotated instead of bouncing signed-in users to the login page.
 */
export async function updateSession(request: NextRequest): Promise<UpdatedSessionResult> {
  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Missing configuration should degrade to "signed out", never crash the edge.
    return { response, user: null }
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const { data } = await supabase.auth.getUser()

  return { response, user: data.user ?? null }
}
