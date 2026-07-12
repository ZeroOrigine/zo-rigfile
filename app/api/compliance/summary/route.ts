// CANONICAL: /api/compliance/summary — the dashboard heartbeat. One call returns
// live totals, per-driver audit readiness, everything that needs attention, and
// the upcoming deadline calendar (soonest first). Statuses are recomputed at
// read time so the numbers are correct the second the page loads.
import { type NextRequest } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase/server'
import { internalErrorResponse, jsonData, unauthorizedResponse } from '@/lib/db/api-helpers'
import { listDrivers } from '@/lib/db/drivers'
import { listItemsWithTypes } from '@/lib/db/dqf-items'
import { ensureProfile } from '@/lib/db/profiles'
import { getEntitlements, type Entitlements } from '@/lib/db/entitlements'
import {
  daysUntil,
  effectiveDqfStatus,
  isAuditReady,
  summarizeStatuses,
  type ComplianceCounts,
} from '@/lib/db/compliance'
import type { RigfileDqfItemStatus } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

const MAX_DEADLINE_ENTRIES = 100

interface DeadlineEntry {
  dqf_item_id: string
  driver_id: string
  driver_name: string
  item_type_code: string
  item_name: string
  cfr_reference: string
  status: RigfileDqfItemStatus
  expires_on: string | null
  days_until_expiration: number | null
}

interface DriverSummary {
  id: string
  name: string
  is_owner_operator: boolean
  status: 'active' | 'inactive'
  compliance: ComplianceCounts & { audit_ready: boolean }
}

interface ComplianceSummaryResponse {
  generated_at: string
  reminder_lead_days: number
  entitlements: Entitlements
  totals: ComplianceCounts & { audit_ready: boolean; drivers: number }
  drivers: DriverSummary[]
  upcoming_deadlines: DeadlineEntry[]
  needs_attention: DeadlineEntry[]
  next_deadline: DeadlineEntry | null
}

export async function GET(_request: NextRequest) {
  try {
    const context = await getAuthenticatedContext()
    if (!context) {
      return unauthorizedResponse()
    }
    const { supabase, user } = context

    const profile = await ensureProfile(supabase, user.id, user.email ?? null)
    const warnDays = profile.reminder_lead_days

    const [{ drivers }, items, entitlements] = await Promise.all([
      listDrivers(supabase, user.id, { from: 0, to: 49 }),
      listItemsWithTypes(supabase, user.id),
      getEntitlements(supabase, user.id),
    ])

    const driverNameById = new Map(
      drivers.map((driver) => [driver.id, `${driver.first_name} ${driver.last_name}`])
    )

    const enrichedItems = items.map((item) => ({
      item,
      status: effectiveDqfStatus(item, warnDays),
      days_until_expiration: item.expires_on ? daysUntil(item.expires_on) : null,
    }))

    const statusesByDriver = new Map<string, RigfileDqfItemStatus[]>()
    for (const entry of enrichedItems) {
      const statuses = statusesByDriver.get(entry.item.driver_id) ?? []
      statuses.push(entry.status)
      statusesByDriver.set(entry.item.driver_id, statuses)
    }

    const driverSummaries: DriverSummary[] = drivers.map((driver) => {
      const counts = summarizeStatuses(statusesByDriver.get(driver.id) ?? [])
      return {
        id: driver.id,
        name: `${driver.first_name} ${driver.last_name}`,
        is_owner_operator: driver.is_owner_operator,
        status: driver.status,
        compliance: { ...counts, audit_ready: isAuditReady(counts) },
      }
    })

    const totalsCounts = summarizeStatuses(enrichedItems.map((entry) => entry.status))

    const toDeadlineEntry = (entry: (typeof enrichedItems)[number]): DeadlineEntry => ({
      dqf_item_id: entry.item.id,
      driver_id: entry.item.driver_id,
      driver_name: driverNameById.get(entry.item.driver_id) ?? 'Unknown driver',
      item_type_code: entry.item.item_type.code,
      item_name: entry.item.item_type.name,
      cfr_reference: entry.item.item_type.cfr_reference,
      status: entry.status,
      expires_on: entry.item.expires_on,
      days_until_expiration: entry.days_until_expiration,
    })

    // The calendar: every dated, applicable item, soonest first.
    const upcomingDeadlines = enrichedItems
      .filter((entry) => entry.item.expires_on !== null && entry.status !== 'not_applicable')
      .sort((a, b) => (a.item.expires_on as string).localeCompare(b.item.expires_on as string))
      .slice(0, MAX_DEADLINE_ENTRIES)
      .map(toDeadlineEntry)

    // Fine exposure right now: expired and missing first, then expiring soon.
    const attentionRank: Partial<Record<RigfileDqfItemStatus, number>> = {
      expired: 0,
      missing: 1,
      expiring_soon: 2,
    }
    const needsAttention = enrichedItems
      .filter((entry) => entry.status in attentionRank)
      .sort((a, b) => {
        const rankDifference = (attentionRank[a.status] ?? 9) - (attentionRank[b.status] ?? 9)
        if (rankDifference !== 0) {
          return rankDifference
        }
        return (a.item.expires_on ?? '9999-12-31').localeCompare(b.item.expires_on ?? '9999-12-31')
      })
      .slice(0, MAX_DEADLINE_ENTRIES)
      .map(toDeadlineEntry)

    const responseBody: ComplianceSummaryResponse = {
      generated_at: new Date().toISOString(),
      reminder_lead_days: warnDays,
      entitlements,
      totals: {
        ...totalsCounts,
        audit_ready: isAuditReady(totalsCounts),
        drivers: drivers.length,
      },
      drivers: driverSummaries,
      upcoming_deadlines: upcomingDeadlines,
      needs_attention: needsAttention,
      next_deadline: upcomingDeadlines[0] ?? null,
    }
    return jsonData(responseBody)
  } catch (error) {
    return internalErrorResponse('compliance.summary', error)
  }
}
