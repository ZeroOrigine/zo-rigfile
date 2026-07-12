// CANONICAL: Profile data service. Routes never query rigfile_profiles directly.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RigfileProfile } from './types'

export const PROFILE_COLUMNS =
  'id, email, full_name, company_name, dot_number, mc_number, phone, timezone, reminder_lead_days, role, created_at, updated_at'

export async function getProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<RigfileProfile | null> {
  const { data, error } = await supabase
    .from('rigfile_profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`)
  }
  return (data as RigfileProfile | null) ?? null
}

/**
 * The signup trigger normally creates the profile row. This is the defensive
 * fallback so a user whose trigger run failed is repaired on first API call
 * instead of hitting mysterious errors.
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  userId: string,
  email: string | null
): Promise<RigfileProfile> {
  const existing = await getProfile(supabase, userId)
  if (existing) {
    return existing
  }

  const { data, error } = await supabase
    .from('rigfile_profiles')
    .insert({ id: userId, email, full_name: '' })
    .select(PROFILE_COLUMNS)
    .single()

  if (error) {
    // Concurrent creation (trigger or parallel request) — re-read before failing.
    const retried = await getProfile(supabase, userId)
    if (retried) {
      return retried
    }
    throw new Error(`Failed to create profile: ${error.message}`)
  }

  return data as RigfileProfile
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  payload: Record<string, unknown>
): Promise<RigfileProfile | null> {
  const { data, error } = await supabase
    .from('rigfile_profiles')
    .update(payload)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`)
  }
  return (data as RigfileProfile | null) ?? null
}
