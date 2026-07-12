// CANONICAL: Client-side API helper for every RigFile dashboard page.
// One fetch wrapper (matching the { data, error } envelope from lib/db/api-helpers),
// one toast bus, shared formatting helpers, and the response types for every route.
// No Tailwind classes live here (this file is not scanned for classes) — pages own styling.
import type {
  PaginationMeta,
  RigfileAuditFile,
  RigfileAuditFileDetail,
  RigfileDqfItemStatus,
  RigfileDqfItemWithType,
  RigfileDriver,
  RigfilePlan,
  RigfileProfile,
  RigfileSubscriptionStatus,
} from '@/lib/db/types'

export type {
  PaginationMeta,
  RigfileAuditFile,
  RigfileAuditFileDetail,
  RigfileDqfItemStatus,
  RigfileDqfItemType,
  RigfileDqfItemWithType,
  RigfileDriver,
  RigfilePlan,
  RigfileProfile,
  RigfileSubscriptionStatus,
} from '@/lib/db/types'

// ---------------------------------------------------------------------------
// Error + fetch wrapper
// ---------------------------------------------------------------------------

export interface ApiErrorShape {
  message: string
  code: string
  fields?: Record<string, string>
}

export class ApiError extends Error {
  code: string
  status: number
  fields?: Record<string, string>

  constructor(message: string, code: string, status: number, fields?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.fields = fields
  }
}

interface ApiEnvelope<T> {
  data: T | null
  error: ApiErrorShape | null
}

/**
 * Fetches a RigFile API route and unwraps the { data, error } envelope.
 * 401 responses bounce the user to /login (session expired) before throwing.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    })
  } catch {
    throw new ApiError(
      "We couldn't reach RigFile — check your connection and try again.",
      'NETWORK_ERROR',
      0
    )
  }

  let payload: ApiEnvelope<T> | null = null
  try {
    payload = (await response.json()) as ApiEnvelope<T>
  } catch {
    payload = null
  }

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.assign('/login')
    }
    throw new ApiError('Please sign in to continue.', 'UNAUTHORIZED', 401)
  }

  if (!response.ok || !payload || payload.error) {
    throw new ApiError(
      payload?.error?.message ?? "That didn't work — give it another try in a moment.",
      payload?.error?.code ?? 'INTERNAL_ERROR',
      response.status,
      payload?.error?.fields
    )
  }

  return payload.data as T
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return "That didn't work — give it another try in a moment."
}

// ---------------------------------------------------------------------------
// Toast bus — the dashboard layout renders the viewport, pages dispatch events
// ---------------------------------------------------------------------------

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastDetail {
  message: string
  tone: ToastTone
}

export const TOAST_EVENT = 'rigfile:toast'

export function notify(message: string, tone: ToastTone = 'info'): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, tone } }))
}

// ---------------------------------------------------------------------------
// Download helper — programmatic anchor click so signed PDFs download in place
// ---------------------------------------------------------------------------

export function triggerDownload(url: string): void {
  if (typeof window === 'undefined') return
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function daysLabel(days: number | null): string {
  if (days === null) return ''
  const magnitude = Math.abs(days)
  const unit = magnitude === 1 ? 'day' : 'days'
  if (days < 0) return `${magnitude} ${unit} overdue`
  if (days === 0) return 'due today'
  return `in ${days} ${unit}`
}

/** Human phrase for an item's expiration state, used on dashboard + checklist. */
export function expiryPhrase(expiresOn: string | null, days: number | null): string {
  if (!expiresOn) return 'No date on file yet'
  if (days === null) return `Expires ${formatDate(expiresOn)}`
  const magnitude = Math.abs(days)
  const unit = magnitude === 1 ? 'day' : 'days'
  if (days < 0) return `Expired ${formatDate(expiresOn)} — ${magnitude} ${unit} ago`
  if (days === 0) return `Expires today (${formatDate(expiresOn)})`
  return `Expires ${formatDate(expiresOn)} — in ${days} ${unit}`
}

export function formatUsd(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

// Per the product spec: expired DQF documents run $1,270+ per violation in DOT audits.
export const PER_VIOLATION_FINE_USD = 1270

export const STATUS_LABELS: Record<RigfileDqfItemStatus, string> = {
  valid: 'Valid',
  expiring_soon: 'Expiring soon',
  expired: 'Expired',
  missing: 'Missing',
  not_applicable: 'N/A',
}

// ---------------------------------------------------------------------------
// API response types (mirror the route handlers exactly)
// ---------------------------------------------------------------------------

export interface ComplianceCounts {
  total: number
  valid: number
  expiring_soon: number
  expired: number
  missing: number
  not_applicable: number
}

export interface Entitlements {
  plan: RigfilePlan
  label: string
  max_drivers: number
  can_generate_audit_pdf: boolean
  subscription_status: RigfileSubscriptionStatus
}

export interface DeadlineEntry {
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

export interface DriverSummary {
  id: string
  name: string
  is_owner_operator: boolean
  status: 'active' | 'inactive'
  compliance: ComplianceCounts & { audit_ready: boolean }
}

export interface ComplianceSummary {
  generated_at: string
  reminder_lead_days: number
  entitlements: Entitlements
  totals: ComplianceCounts & { audit_ready: boolean; drivers: number }
  drivers: DriverSummary[]
  upcoming_deadlines: DeadlineEntry[]
  needs_attention: DeadlineEntry[]
  next_deadline: DeadlineEntry | null
}

export interface DriverWithCompliance extends RigfileDriver {
  compliance: ComplianceCounts & { audit_ready: boolean }
}

export interface DriverListResponse {
  drivers: DriverWithCompliance[]
  pagination: PaginationMeta
}

export interface DriverCreateResponse {
  driver: RigfileDriver
  dqf_items_seeded: number
  message: string
}

export interface DqfItemView extends RigfileDqfItemWithType {
  days_until_expiration: number | null
}

export interface DriverDetailResponse {
  driver: RigfileDriver
  dqf_items: DqfItemView[]
  compliance: ComplianceCounts & { audit_ready: boolean; reminder_lead_days: number }
}

export interface DqfItemResponse {
  dqf_item: DqfItemView
  auto_calculated_expiration?: boolean
  message?: string
}

export interface DocumentUploadTicket {
  storage_path: string
  upload_url: string
  token: string
  expires_in_seconds: number
  next_step: string
}

export interface AuditFileListResponse {
  audit_files: RigfileAuditFile[]
  pagination: PaginationMeta
}

export interface AuditFileCreateResponse {
  audit_file: RigfileAuditFileDetail
  download_url: string | null
  download_url_expires_in_seconds: number
  audit_ready: boolean
  message: string
}

export interface AuditFileDetailResponse {
  audit_file: RigfileAuditFileDetail
  download_url: string | null
  download_url_expires_in_seconds: number | null
}

export interface ProfileResponse {
  profile: RigfileProfile
  entitlements: Entitlements
  message?: string
}
