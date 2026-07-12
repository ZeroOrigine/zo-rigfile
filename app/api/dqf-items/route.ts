// CANONICAL: /api/dqf-items — the compliance calendar feed. Lists every DQF item
// across the operator's drivers, statuses recomputed live (never stale), sorted
// soonest-deadline-first. Filters: driver_id, status, due_within_days.
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedContext } from '@/lib/supabase/server'
import {
  buildPaginationMeta,
  internalErrorResponse,
  jsonData,
  parsePagination,
  unauthorizedResponse,
  zodValidationResponse,
} from '@/lib/db/api-helpers'
import { listItemsWithTypes } from '@/lib/db/dqf-items'
import { getDriverNameMap } from '@/lib/db/drivers'
import { getProfile } from '@/lib/db/profiles'
import {
  DEFAULT_REMINDER_LEAD_DAYS,
  daysUntil,
  effectiveDqfStatus,
} from '@/lib/db/compliance'
import type { PaginationMeta, RigfileDqfItemWithType } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

interface DqfItemListEntry extends RigfileDqfItemWithType {
  days_until_expiration: number | null
  driver: { id: string; name: string }
}

interface DqfItemListResponse {
  dqf_items: DqfItemListEntry[]
  reminder_lead_days: number
  pagination: PaginationMeta
}

const listQuerySchema = z.object({
  driver_id: z.string().uuid('driver_id must be a valid driver ID.').optional(),
  status: z
    .enum(['valid', 'expiring_soon', 'expired', 'missing', 'not_applicable'], {
      errorMap: () => ({
        message: 'status must be one of: valid, expiring_soon, expired, missing, not_applicable.',
      }),
    })
    .optional(),
  due_within_days: z.coerce
    .number({ invalid_type_error: 'due_within_days must be a number of days.' })
    .int('due_within_days must be a whole number.')
    .min(1, 'due_within_days must be at least 1.')
    .max(365, 'due_within_days is capped at 365.')
    .optional(),
})

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthenticatedContext()
    if (!context) {
      return unauthorizedResponse()
    }
    const { supabase, user } = context

    const { searchParams } = new URL(request.url)
    const pagination = parsePagination(searchParams)

    const rawQuery: Record<string, string> = {}
    for (const key of ['driver_id', 'status', 'due_within_days']) {
      const value = searchParams.get(key)
      if (value !== null && value !== '') {
        rawQuery[key] = value
      }
    }
    const parsedQuery = listQuerySchema.safeParse(rawQuery)
    if (!parsedQuery.success) {
      return zodValidationResponse(parsedQuery.error)
    }
    const filters = parsedQuery.data

    const profile = await getProfile(supabase, user.id)
    const warnDays = profile?.reminder_lead_days ?? DEFAULT_REMINDER_LEAD_DAYS

    // A user's data is hard-capped at 180 rows (10 drivers x 18 items), so we
    // load once, recompute statuses live, and filter/paginate in memory. This
    // keeps filters accurate even between daily status-refresh cron runs.
    const [items, driverNames] = await Promise.all([
      listItemsWithTypes(supabase, user.id, filters.driver_id),
      getDriverNameMap(supabase, user.id),
    ])

    const entries: DqfItemListEntry[] = items.map((item) => ({
      ...item,
      status: effectiveDqfStatus(item, warnDays),
      days_until_expiration: item.expires_on ? daysUntil(item.expires_on) : null,
      driver: { id: item.driver_id, name: driverNames.get(item.driver_id) ?? 'Unknown driver' },
    }))

    const filtered = entries.filter((entry) => {
      if (filters.status && entry.status !== filters.status) {
        return false
      }
      if (filters.due_within_days !== undefined) {
        if (entry.days_until_expiration === null) {
          return false
        }
        if (entry.days_until_expiration > filters.due_within_days) {
          return false
        }
        if (entry.status === 'not_applicable') {
          return false
        }
      }
      return true
    })

    // Calendar order: dated items soonest first, undated items after, both
    // tie-broken by the federal checklist order.
    filtered.sort((a, b) => {
      if (a.expires_on && b.expires_on) {
        return (
          a.expires_on.localeCompare(b.expires_on) || a.item_type.sort_order - b.item_type.sort_order
        )
      }
      if (a.expires_on) {
        return -1
      }
      if (b.expires_on) {
        return 1
      }
      return a.item_type.sort_order - b.item_type.sort_order
    })

    const total = filtered.length
    const pageItems = filtered.slice(pagination.from, pagination.from + pagination.limit)

    const responseBody: DqfItemListResponse = {
      dqf_items: pageItems,
      reminder_lead_days: warnDays,
      pagination: buildPaginationMeta(pagination.page, pagination.limit, total),
    }
    return jsonData(responseBody)
  } catch (error) {
    return internalErrorResponse('dqf-items.list', error)
  }
}
