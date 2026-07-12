// CANONICAL: DQF item data service — the kernel table of RigFile.
// Routes never query rigfile_dqf_items directly.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RigfileDqfItemStatus, RigfileDqfItemWithType } from './types'

export const DQF_ITEM_COLUMNS =
  'id, driver_id, item_type_id, status, issued_on, expires_on, document_path, document_name, document_uploaded_at, notes, created_at, updated_at'

export const DQF_ITEM_TYPE_COLUMNS =
  'id, code, name, description, cfr_reference, default_validity_months, can_expire, is_conditional, sort_order'

export const DQF_ITEM_WITH_TYPE_SELECT = `${DQF_ITEM_COLUMNS}, item_type:rigfile_dqf_item_types(${DQF_ITEM_TYPE_COLUMNS})`

// Hard ceiling: fleet plan caps at 10 drivers x 18 items = 180 rows. 500 is headroom.
const MAX_ITEM_ROWS = 500

export async function listItemsWithTypes(
  supabase: SupabaseClient,
  userId: string,
  driverId?: string
): Promise<RigfileDqfItemWithType[]> {
  let query = supabase
    .from('rigfile_dqf_items')
    .select(DQF_ITEM_WITH_TYPE_SELECT)
    .eq('user_id', userId)
    .limit(MAX_ITEM_ROWS)

  if (driverId) {
    query = query.eq('driver_id', driverId)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to load DQF items: ${error.message}`)
  }
  return (data ?? []) as unknown as RigfileDqfItemWithType[]
}

export interface DqfItemStatusRow {
  driver_id: string
  status: RigfileDqfItemStatus
  issued_on: string | null
  expires_on: string | null
  document_path: string | null
}

export async function listItemStatusRows(
  supabase: SupabaseClient,
  userId: string,
  driverIds: string[]
): Promise<DqfItemStatusRow[]> {
  if (driverIds.length === 0) {
    return []
  }
  const { data, error } = await supabase
    .from('rigfile_dqf_items')
    .select('driver_id, status, issued_on, expires_on, document_path')
    .eq('user_id', userId)
    .in('driver_id', driverIds)
    .limit(MAX_ITEM_ROWS)

  if (error) {
    throw new Error(`Failed to load DQF item statuses: ${error.message}`)
  }
  return (data ?? []) as DqfItemStatusRow[]
}

export async function getItemByIdWithType(
  supabase: SupabaseClient,
  userId: string,
  itemId: string
): Promise<RigfileDqfItemWithType | null> {
  const { data, error } = await supabase
    .from('rigfile_dqf_items')
    .select(DQF_ITEM_WITH_TYPE_SELECT)
    .eq('user_id', userId)
    .eq('id', itemId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load DQF item: ${error.message}`)
  }
  return (data as unknown as RigfileDqfItemWithType | null) ?? null
}

export async function updateDqfItem(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  payload: Record<string, unknown>
): Promise<RigfileDqfItemWithType | null> {
  const { data, error } = await supabase
    .from('rigfile_dqf_items')
    .update(payload)
    .eq('user_id', userId)
    .eq('id', itemId)
    .select(DQF_ITEM_WITH_TYPE_SELECT)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to update DQF item: ${error.message}`)
  }
  return (data as unknown as RigfileDqfItemWithType | null) ?? null
}
