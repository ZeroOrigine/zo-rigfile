// CANONICAL: Compliance status rules for RigFile.
// TypeScript mirror of the SQL function rigfile_compute_dqf_status — the DB
// trigger owns the stored column; this mirror recomputes at read time so an
// audit PDF or dashboard is accurate even between daily cron refreshes.
import type { RigfileDqfItemStatus } from './types'

export const DEFAULT_REMINDER_LEAD_DAYS = 30

const MILLISECONDS_PER_DAY = 86_400_000

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00Z`)
}

function startOfTodayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/** Whole days from today (UTC) until the given date. Negative when in the past. */
export function daysUntil(dateString: string): number {
  const difference = parseDateOnly(dateString).getTime() - startOfTodayUtc().getTime()
  return Math.round(difference / MILLISECONDS_PER_DAY)
}

/**
 * Mirrors rigfile_compute_dqf_status exactly:
 *   no expiration + no document  -> missing
 *   no expiration + document     -> valid
 *   past expiration              -> expired
 *   inside the reminder window   -> expiring_soon
 *   otherwise                    -> valid
 */
export function computeDqfStatus(
  expiresOn: string | null,
  hasDocument: boolean,
  warnDays: number = DEFAULT_REMINDER_LEAD_DAYS
): Exclude<RigfileDqfItemStatus, 'not_applicable'> {
  if (!expiresOn) {
    return hasDocument ? 'valid' : 'missing'
  }
  const remainingDays = daysUntil(expiresOn)
  if (remainingDays < 0) {
    return 'expired'
  }
  if (remainingDays <= warnDays) {
    return 'expiring_soon'
  }
  return 'valid'
}

export interface DqfStatusSource {
  status: RigfileDqfItemStatus
  issued_on: string | null
  expires_on: string | null
  document_path: string | null
}

/** A user's explicit 'not_applicable' choice is always respected; everything else is computed. */
export function effectiveDqfStatus(item: DqfStatusSource, warnDays: number): RigfileDqfItemStatus {
  if (item.status === 'not_applicable') {
    return 'not_applicable'
  }
  const hasDocument = item.document_path !== null || item.issued_on !== null
  return computeDqfStatus(item.expires_on, hasDocument, warnDays)
}

export interface ComplianceCounts {
  total: number
  valid: number
  expiring_soon: number
  expired: number
  missing: number
  not_applicable: number
}

export function summarizeStatuses(statuses: RigfileDqfItemStatus[]): ComplianceCounts {
  const counts: ComplianceCounts = {
    total: statuses.length,
    valid: 0,
    expiring_soon: 0,
    expired: 0,
    missing: 0,
    not_applicable: 0,
  }
  for (const status of statuses) {
    counts[status] += 1
  }
  return counts
}

/** Audit-ready means zero fine exposure: nothing expired, nothing missing. */
export function isAuditReady(counts: ComplianceCounts): boolean {
  return counts.expired === 0 && counts.missing === 0
}

/**
 * Adds calendar months to a YYYY-MM-DD string, clamping overflow to the last
 * day of the target month (Jan 31 + 1 month -> Feb 28/29, never Mar 3).
 * Used to auto-fill expirations from the federal default validity windows.
 */
export function addMonthsToDateString(value: string, months: number): string {
  const [year, month, day] = value.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1 + months, day))
  if (result.getUTCDate() !== day) {
    result.setUTCDate(0)
  }
  return result.toISOString().slice(0, 10)
}
