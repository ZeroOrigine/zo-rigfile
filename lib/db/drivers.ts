// CANONICAL: Driver data service. Routes never query rigfile_drivers directly.
// Every function is scoped by userId in addition to RLS — defense in depth,
// and the explicit filter keeps queries on the idx_rigfile_drivers_user_id index.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RigfileDriver, RigfileDriverStatus } from './types'

export const DRIVER_COLUMNS =
  'id, first_name, last_name, is_owner_operator, date_of_birth, hire_date, cdl_number, cdl_state, cdl_class, status, created_at, updated_at'

export interface CreateDriverInput {
  first_name: string
  last_name: string
  is_owner_operator: boolean
  date_of_birth: string | null
  hire_date: string | null
  cdl_number: string | null
  cdl_state: string | null
  cdl_class: 'A' | 'B' | 'C' | null
}

export async function countDrivers(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('rigfile_drivers')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to count drivers: ${error.message}`)
  }
  return count ?? 0
}

export async function listDrivers(
  supabase: SupabaseClient,
  userId: string,
  options: { status?: RigfileDriverStatus | null; from: number; to: number }
): Promise<{ drivers: RigfileDriver[]; total: number }> {
  let query = supabase
    .from('rigfile_drivers')
    .select(DRIVER_COLUMNS, { count: 'exact' })
    .eq('user_id', userId)

  if (options.status) {
    query = query.eq('status', options.status)
  }

  const { data, error, count } = await query
    .order('is_owner_operator', { ascending: false })
    .order('created_at', { ascending: true })
    .range(options.from, options.to)

  if (error) {
    throw new Error(`Failed to list drivers: ${error.message}`)
  }
  return { drivers: (data ?? []) as RigfileDriver[], total: count ?? 0 }
}

export async function getDriverById(
  supabase: SupabaseClient,
  userId: string,
  driverId: string
): Promise<RigfileDriver | null> {
  const { data, error } = await supabase
    .from('rigfile_drivers')
    .select(DRIVER_COLUMNS)
    .eq('user_id', userId)
    .eq('id', driverId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load driver: ${error.message}`)
  }
  return (data as RigfileDriver | null) ?? null
}

export async function getDriverNameMap(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('rigfile_drivers')
    .select('id, first_name, last_name')
    .eq('user_id', userId)
    .limit(100)

  if (error) {
    throw new Error(`Failed to load driver names: ${error.message}`)
  }
  const entries = (data ?? []) as { id: string; first_name: string; last_name: string }[]
  return new Map(entries.map((driver) => [driver.id, `${driver.first_name} ${driver.last_name}`]))
}

export async function createDriver(
  supabase: SupabaseClient,
  userId: string,
  input: CreateDriverInput
): Promise<RigfileDriver> {
  const { data, error } = await supabase
    .from('rigfile_drivers')
    .insert({
      user_id: userId,
      first_name: input.first_name,
      last_name: input.last_name,
      is_owner_operator: input.is_owner_operator,
      date_of_birth: input.date_of_birth,
      hire_date: input.hire_date,
      cdl_number: input.cdl_number,
      cdl_state: input.cdl_state,
      cdl_class: input.cdl_class,
    })
    .select(DRIVER_COLUMNS)
    .single()

  if (error || !data) {
    throw new Error(`Failed to create driver: ${error ? error.message : 'no row returned'}`)
  }
  return data as RigfileDriver
}

export async function updateDriver(
  supabase: SupabaseClient,
  userId: string,
  driverId: string,
  payload: Record<string, unknown>
): Promise<RigfileDriver | null> {
  const { data, error } = await supabase
    .from('rigfile_drivers')
    .update(payload)
    .eq('user_id', userId)
    .eq('id', driverId)
    .select(DRIVER_COLUMNS)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to update driver: ${error.message}`)
  }
  return (data as RigfileDriver | null) ?? null
}

export async function deleteDriver(
  supabase: SupabaseClient,
  userId: string,
  driverId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('rigfile_drivers')
    .delete()
    .eq('user_id', userId)
    .eq('id', driverId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to delete driver: ${error.message}`)
  }
  return data !== null
}
