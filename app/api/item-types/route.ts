// CANONICAL: /api/item-types — the 18 federal DQF item definitions (read-only
// reference data from rigfile_dqf_item_types, seeded by the migration).
import { type NextRequest } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase/server'
import { internalErrorResponse, jsonData, unauthorizedResponse } from '@/lib/db/api-helpers'
import { DQF_ITEM_TYPE_COLUMNS } from '@/lib/db/dqf-items'
import type { RigfileDqfItemType } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

interface ItemTypeListResponse {
  item_types: RigfileDqfItemType[]
}

export async function GET(_request: NextRequest) {
  try {
    const context = await getAuthenticatedContext()
    if (!context) {
      return unauthorizedResponse()
    }
    const { supabase } = context

    const { data, error } = await supabase
      .from('rigfile_dqf_item_types')
      .select(DQF_ITEM_TYPE_COLUMNS)
      .order('sort_order', { ascending: true })
      .limit(50)

    if (error) {
      throw new Error(`Failed to load DQF item types: ${error.message}`)
    }

    const responseBody: ItemTypeListResponse = {
      item_types: (data ?? []) as RigfileDqfItemType[],
    }
    return jsonData(responseBody)
  } catch (error) {
    return internalErrorResponse('item-types.list', error)
  }
}
