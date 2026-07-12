'use client'

// CANONICAL: Driver DQF checklist — the core of RigFile. All 18 federal items
// with inline date editing, document attachment, N/A handling, and the one-click
// audit-ready PDF generator.
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Modal as SharedModal } from '@/components/modal'
import {
  ApiError,
  apiFetch,
  errorMessage,
  expiryPhrase,
  formatDate,
  formatUsd,
  notify,
  triggerDownload,
  PER_VIOLATION_FINE_USD,
  STATUS_LABELS,
  type AuditFileCreateResponse,
  type ComplianceCounts,
  type DocumentUploadTicket,
  type DqfItemResponse,
  type DqfItemView,
  type DriverDetailResponse,
  type Entitlements,
  type ProfileResponse,
  type RigfileDqfItemStatus,
  type RigfileDriver,
} from '@/lib/core/api'

const inputClass =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30'
const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'
const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'
const btnDanger =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'

const STATUS_BADGE: Record<RigfileDqfItemStatus, string> = {
  valid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  expiring_soon: 'bg-amber-50 text-amber-800 ring-amber-600/30',
  expired: 'bg-red-50 text-red-700 ring-red-600/30',
  missing: 'bg-orange-50 text-orange-700 ring-orange-600/30',
  not_applicable: 'bg-slate-100 text-slate-500 ring-slate-400/30',
}

const STATUS_BORDER: Record<RigfileDqfItemStatus, string> = {
  valid: 'border-l-emerald-400',
  expiring_soon: 'border-l-amber-400',
  expired: 'border-l-red-500',
  missing: 'border-l-orange-400',
  not_applicable: 'border-l-slate-300',
}

function StatusBadge({ status }: { status: RigfileDqfItemStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_BADGE[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

// QA-022: the accessible, focus-trapping Modal now lives in @/components/modal.
// Provide a thin wrapper here so this page's `title`/`onClose`/`children` call
// sites keep working while delegating focus management to the shared component.
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <SharedModal open onClose={onClose} title={title}>
      {children}
    </SharedModal>
  )
}

function tally(items: DqfItemView[]): ComplianceCounts & { audit_ready: boolean } {
  const counts: ComplianceCounts = {
    total: items.length,
    valid: 0,
    expiring_soon: 0,
    expired: 0,
    missing: 0,
    not_applicable: 0,
  }
  for (const entry of items) {
    counts[entry.status] += 1
  }
  return { ...counts, audit_ready: counts.expired === 0 && counts.missing === 0 }
}

// ---------------------------------------------------------------------------
// Checklist item row (accordion)
// ---------------------------------------------------------------------------

interface ItemRowProps {
  item: DqfItemView
  expanded: boolean
  onToggle: () => void
  onUpdated: (item: DqfItemView) => void
}

function ItemRow({ item, expanded, onToggle, onUpdated }: ItemRowProps) {
  const [issuedOn, setIssuedOn] = useState(item.issued_on ?? '')
  const [expiresOn, setExpiresOn] = useState(item.expires_on ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [togglingNa, setTogglingNa] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setIssuedOn(item.issued_on ?? '')
    setExpiresOn(item.expires_on ?? '')
    setNotes(item.notes ?? '')
    setFieldErrors({})
  }, [item.id, item.updated_at, item.issued_on, item.expires_on, item.notes])

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload: Record<string, unknown> = {}
    if ((issuedOn || null) !== item.issued_on) payload.issued_on = issuedOn || null
    if ((expiresOn || null) !== item.expires_on) payload.expires_on = expiresOn || null
    if ((notes.trim() || null) !== item.notes) payload.notes = notes.trim() || null

    if (Object.keys(payload).length === 0) {
      notify('Nothing changed yet — update a date or note first.', 'info')
      return
    }

    setSaving(true)
    setFieldErrors({})
    try {
      const response = await apiFetch<DqfItemResponse>(`/api/dqf-items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      onUpdated(response.dqf_item)
      if (response.message) {
        notify(response.message, 'info')
      } else if (response.dqf_item.status === 'valid') {
        notify(`${item.item_type.name} is locked in.`, 'success')
      } else if (response.dqf_item.status === 'expiring_soon') {
        notify(`Saved. Heads up — ${expiryPhrase(response.dqf_item.expires_on, response.dqf_item.days_until_expiration).toLowerCase()}.`, 'info')
      } else {
        notify('Saved.', 'success')
      }
    } catch (error) {
      if (error instanceof ApiError && error.fields) setFieldErrors(error.fields)
      notify(errorMessage(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploading(true)
    try {
      const ticket = await apiFetch<DocumentUploadTicket>(`/api/dqf-items/${item.id}/document`, {
        method: 'POST',
        body: JSON.stringify({ file_name: file.name }),
      })
      const putResponse = await fetch(ticket.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!putResponse.ok) {
        throw new ApiError("The upload didn't go through — try again in a moment.", 'STORAGE_ERROR', putResponse.status)
      }
      const attached = await apiFetch<DqfItemResponse>(`/api/dqf-items/${item.id}/document`, {
        method: 'PUT',
        body: JSON.stringify({ storage_path: ticket.storage_path, file_name: file.name }),
      })
      onUpdated(attached.dqf_item)
      notify(attached.message ?? 'Document attached.', 'success')
    } catch (error) {
      notify(errorMessage(error), 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemoveDocument() {
    setUploading(true)
    try {
      const response = await apiFetch<DqfItemResponse>(`/api/dqf-items/${item.id}/document`, {
        method: 'DELETE',
      })
      onUpdated(response.dqf_item)
      notify(response.message ?? 'Document removed.', 'info')
    } catch (error) {
      notify(errorMessage(error), 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleToggleNa(target: 'not_applicable' | 'recompute') {
    setTogglingNa(true)
    try {
      const response = await apiFetch<DqfItemResponse>(`/api/dqf-items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: target }),
      })
      onUpdated(response.dqf_item)
      notify(
        target === 'not_applicable'
          ? `${item.item_type.name} won't count against you. You can track it again anytime.`
          : `Tracking ${item.item_type.name} again.`,
        'info'
      )
    } catch (error) {
      notify(errorMessage(error), 'error')
    } finally {
      setTogglingNa(false)
    }
  }

  const type = item.item_type
  const isNa = item.status === 'not_applicable'
  const panelId = `dqf-panel-${item.id}`

  return (
    <li
      id={`dqf-item-${item.id}`}
      className={`border-l-4 bg-white ${STATUS_BORDER[item.status]} ${isNa ? 'opacity-70' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 sm:px-5"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600" aria-hidden="true">
          {type.sort_order}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-800">{type.name}</span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {isNa ? `Marked N/A · ${type.cfr_reference}` : type.can_expire || item.expires_on ? expiryPhrase(item.expires_on, item.days_until_expiration) : item.issued_on || item.document_path ? `On file since ${formatDate(item.issued_on)}` : 'No record yet'}
          </span>
        </span>
        {item.document_path && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-slate-400" aria-label="Document attached" role="img">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 12.5-8.5 8.5a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10.5 19a2 2 0 0 1-3-3l7.5-7.5" />
          </svg>
        )}
        <StatusBadge status={item.status} />
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div id={panelId} className="border-t border-slate-100 px-4 py-5 sm:px-5 animate-fade-up">
          <p className="text-sm leading-relaxed text-slate-600">
            {type.description} <span className="whitespace-nowrap text-xs text-slate-400">({type.cfr_reference})</span>
          </p>

          {isNa ? (
            <div className="mt-4 flex flex-col gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">This item is marked as not applicable to this driver.</p>
              <button type="button" onClick={() => void handleToggleNa('recompute')} disabled={togglingNa} className={btnSecondary}>
                {togglingNa ? 'Updating…' : 'Track it again'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSave} className="mt-4 space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={`issued-${item.id}`} className="block text-sm font-semibold text-slate-700">
                    Issued on
                  </label>
                  <input
                    id={`issued-${item.id}`}
                    type="date"
                    value={issuedOn}
                    onChange={(event) => setIssuedOn(event.target.value)}
                    className={`${inputClass} mt-1`}
                  />
                  {fieldErrors.issued_on && (
                    <p role="alert" className="mt-1 text-xs font-medium text-red-600">
                      {fieldErrors.issued_on}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor={`expires-${item.id}`} className="block text-sm font-semibold text-slate-700">
                    Expires on
                  </label>
                  <input
                    id={`expires-${item.id}`}
                    type="date"
                    value={expiresOn}
                    onChange={(event) => setExpiresOn(event.target.value)}
                    className={`${inputClass} mt-1`}
                  />
                  {type.default_validity_months && !expiresOn && (
                    <p className="mt-1 text-xs text-slate-500">
                      Leave blank — we&apos;ll set it {type.default_validity_months} months after the issue date
                      automatically.
                    </p>
                  )}
                  {fieldErrors.expires_on && (
                    <p role="alert" className="mt-1 text-xs font-medium text-red-600">
                      {fieldErrors.expires_on}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor={`notes-${item.id}`} className="block text-sm font-semibold text-slate-700">
                  Notes
                </label>
                <textarea
                  id={`notes-${item.id}`}
                  rows={2}
                  maxLength={2000}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Examiner name, registry number, where the original lives…"
                  className={`${inputClass} mt-1`}
                />
                {fieldErrors.notes && (
                  <p role="alert" className="mt-1 text-xs font-medium text-red-600">
                    {fieldErrors.notes}
                  </p>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">Proof document</p>
                {item.document_name ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="inline-flex max-w-full items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-200">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 3h6l4 4v14H8zM14 3v4h4" />
                      </svg>
                      <span className="truncate">{item.document_name}</span>
                    </span>
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="text-sm font-semibold text-blue-700 hover:text-blue-800 disabled:opacity-60">
                      Replace
                    </button>
                    <button type="button" onClick={() => void handleRemoveDocument()} disabled={uploading} className="text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-60">
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="mt-2">
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className={btnSecondary}>
                      {uploading ? 'Uploading…' : 'Attach a file'}
                    </button>
                    <p className="mt-1.5 text-xs text-slate-500">PDF, JPG, PNG, WEBP, or HEIC. A phone photo works fine.</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
                  onChange={(event) => void handleFileChange(event)}
                  className="sr-only"
                  aria-label={`Attach document for ${type.name}`}
                />
                {uploading && item.document_name && <p className="mt-2 text-xs text-slate-500">Working on it…</p>}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={saving} className={btnPrimary}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                {type.is_conditional && (
                  <button type="button" onClick={() => void handleToggleNa('not_applicable')} disabled={togglingNa} className={btnSecondary}>
                    {togglingNa ? 'Updating…' : "Doesn't apply to me"}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function DriverSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="skeleton h-8 w-40 rounded-lg" />
      <div className="skeleton h-36 w-full rounded-2xl" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="skeleton h-16 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function DriverChecklist() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawId = params?.id
  const driverId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : ''
  const highlightItemId = searchParams.get('item')

  const [detail, setDetail] = useState<DriverDetailResponse | null>(null)
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [success, setSuccess] = useState<AuditFileCreateResponse | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const didAutoExpand = useRef(false)

  const load = useCallback(async () => {
    if (!driverId) return
    setLoading(true)
    setLoadError(null)
    setNotFound(false)
    try {
      const [detailResponse, profileResponse] = await Promise.all([
        apiFetch<DriverDetailResponse>(`/api/drivers/${driverId}`),
        apiFetch<ProfileResponse>('/api/profile').catch(() => null),
      ])
      setDetail(detailResponse)
      if (profileResponse) setEntitlements(profileResponse.entitlements)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setNotFound(true)
      } else {
        setLoadError(errorMessage(error))
      }
    } finally {
      setLoading(false)
    }
  }, [driverId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!detail || !highlightItemId || didAutoExpand.current) return
    didAutoExpand.current = true
    setExpandedId(highlightItemId)
    window.setTimeout(() => {
      document.getElementById(`dqf-item-${highlightItemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }, [detail, highlightItemId])

  const applyItemUpdate = useCallback((updated: DqfItemView) => {
    setDetail((previous) => {
      if (!previous) return previous
      const items = previous.dqf_items.map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry))
      return {
        ...previous,
        dqf_items: items,
        compliance: { ...tally(items), reminder_lead_days: previous.compliance.reminder_lead_days },
      }
    })
  }, [])

  async function generateAuditPdf() {
    if (entitlements && !entitlements.can_generate_audit_pdf) {
      setUpgradeOpen(true)
      return
    }
    setGenerating(true)
    try {
      const response = await apiFetch<AuditFileCreateResponse>('/api/audit-files', {
        method: 'POST',
        body: JSON.stringify({ driver_id: driverId }),
      })
      if (response.download_url) triggerDownload(response.download_url)
      setSuccess(response)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'UPGRADE_REQUIRED') {
        setUpgradeOpen(true)
      } else {
        notify(errorMessage(error), 'error')
      }
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <DriverSkeleton />

  if (notFound) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center animate-fade-up">
        <h1 className="text-xl text-slate-900">We couldn&apos;t find that driver</h1>
        <p className="mt-2 text-sm text-slate-600">They may have been removed. Your other records are untouched.</p>
        <Link href="/dashboard" className={`${btnPrimary} mt-5`}>
          Back to dashboard
        </Link>
      </div>
    )
  }

  if (loadError || !detail) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center animate-fade-up">
        <h1 className="text-xl text-slate-900">We couldn&apos;t load this checklist</h1>
        <p className="mt-2 text-sm text-slate-600">{loadError ?? 'Give it another try in a moment.'}</p>
        <button type="button" onClick={() => void load()} className={`${btnPrimary} mt-5`}>
          Try again
        </button>
      </div>
    )
  }

  const { driver, dqf_items: items, compliance } = detail
  const onFile = compliance.total - compliance.expired - compliance.missing
  const percent = compliance.total > 0 ? Math.round((onFile / compliance.total) * 100) : 0
  const violations = compliance.expired + compliance.missing
  const cdlSummary = driver.cdl_number
    ? `CDL ${driver.cdl_number}${driver.cdl_state ? ` · ${driver.cdl_state}` : ''}${driver.cdl_class ? ` · Class ${driver.cdl_class}` : ''}`
    : 'No CDL on file yet'

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="m15 6-6 6 6 6" />
        </svg>
        Dashboard
      </Link>

      {/* Driver header */}
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-fade-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl text-slate-900">
              {driver.first_name} {driver.last_name}
              {driver.is_owner_operator && (
                <span className="ml-2 align-middle rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">Owner-operator</span>
              )}
              {driver.status === 'inactive' && (
                <span className="ml-2 align-middle rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Inactive</span>
              )}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {cdlSummary}
              {driver.hire_date && ` · Hired ${formatDate(driver.hire_date)}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditOpen(true)} className={btnSecondary}>
              Edit driver
            </button>
            <button type="button" onClick={() => void generateAuditPdf()} disabled={generating} className={`${btnPrimary} hidden md:inline-flex`}>
              {generating ? (
                'Building your audit file…'
              ) : (
                <>
                  {entitlements && !entitlements.can_generate_audit_pdf && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  )}
                  Generate audit PDF
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-sm">
            <p className="font-semibold text-slate-700">
              {onFile} of {compliance.total} items on file
            </p>
            {compliance.audit_ready ? (
              <p className="font-semibold text-emerald-600">Audit-ready ✓</p>
            ) : (
              <p className="font-semibold text-red-600">
                {violations} flagged — up to {formatUsd(violations * PER_VIOLATION_FINE_USD)} exposure
              </p>
            )}
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${percent}% of items on file`}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${compliance.audit_ready ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            {compliance.expired > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">{compliance.expired} expired</span>}
            {compliance.missing > 0 && <span className="rounded-full bg-orange-50 px-2.5 py-1 text-orange-700">{compliance.missing} missing</span>}
            {compliance.expiring_soon > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">
                {compliance.expiring_soon} expiring within {compliance.reminder_lead_days} days
              </span>
            )}
            {compliance.not_applicable > 0 && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">{compliance.not_applicable} N/A</span>}
          </div>
        </div>
      </header>

      {compliance.audit_ready && (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between animate-fade-up">
          <p className="text-sm font-medium text-emerald-800">
            This file is audit-ready. Generate the PDF and keep a printed copy in your truck.
          </p>
          <button type="button" onClick={() => void generateAuditPdf()} disabled={generating} className={btnPrimary}>
            {generating ? 'Building…' : 'Generate audit PDF'}
          </button>
        </div>
      )}

      {/* The 18-item checklist */}
      <section aria-label="DQF checklist" className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <div className="border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="text-lg text-slate-900">The 18 federal DQF items</h2>
          <p className="mt-0.5 text-xs text-slate-500">In the order an auditor checks them (49 CFR Part 391).</p>
        </div>
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId((current) => (current === item.id ? null : item.id))}
              onUpdated={applyItemUpdate}
            />
          ))}
        </ul>
      </section>

      {/* Mobile sticky generate bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:hidden">
        <button type="button" onClick={() => void generateAuditPdf()} disabled={generating} className={`${btnPrimary} w-full`}>
          {generating ? 'Building your audit file…' : 'Generate audit PDF'}
        </button>
      </div>

      {/* Success modal */}
      {success && (
        <Modal title={success.audit_ready ? 'Audit-ready file generated' : 'PDF generated — with warnings'} onClose={() => setSuccess(null)}>
          <div className="flex flex-col items-center text-center">
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl animate-pop ${success.audit_ready ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-9 w-9" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8.3 7.5 9.9 4.3-1.6 7.5-5.3 7.5-9.9v-6L12 2.5Z" />
                {success.audit_ready && <path strokeLinecap="round" strokeLinejoin="round" d="m8.7 12 2.4 2.4 4.5-4.6" />}
              </svg>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">{success.message}</p>
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {success.audit_file.items_valid} valid · {success.audit_file.items_expiring_soon} expiring ·{' '}
              {success.audit_file.items_expired} expired · {success.audit_file.items_missing} missing
            </p>
            <div className="mt-5 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
              {success.download_url && (
                <button type="button" onClick={() => triggerDownload(success.download_url as string)} className={btnPrimary}>
                  Download again
                </button>
              )}
              <Link href="/audit-files" className={btnSecondary}>
                View all audit PDFs
              </Link>
            </div>
          </div>
        </Modal>
      )}

      {upgradeOpen && (
        <Modal title="Unlock audit-ready PDFs" onClose={() => setUpgradeOpen(false)}>
          <p className="text-sm leading-relaxed text-slate-600">
            The Solo plan turns this checklist into a stamped, audit-ready DQF PDF — unlimited, whenever an
            officer asks for it. Your compliance calendar stays free forever.
          </p>
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            One expired med card can mean a {formatUsd(PER_VIOLATION_FINE_USD)}+ fine at audit. Solo exists so
            that never happens.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link href="/billing" className={btnPrimary}>
              See plans
            </Link>
            <button type="button" onClick={() => setUpgradeOpen(false)} className={btnSecondary}>
              Not now
            </button>
          </div>
        </Modal>
      )}

      {editOpen && (
        <EditDriverModal
          driver={driver}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setDetail((previous) => (previous ? { ...previous, driver: updated } : previous))
            setEditOpen(false)
            notify('Driver details saved.', 'success')
          }}
          onDeleted={() => {
            notify('Driver removed. Their DQF checklist and audit history went with them.', 'info')
            router.push('/dashboard')
          }}
        />
      )}
    </div>
  )
}

interface EditDriverModalProps {
  driver: RigfileDriver
  onClose: () => void
  onSaved: (driver: RigfileDriver) => void
  onDeleted: () => void
}

function EditDriverModal({ driver, onClose, onSaved, onDeleted }: EditDriverModalProps) {
  const [firstName, setFirstName] = useState(driver.first_name)
  const [lastName, setLastName] = useState(driver.last_name)
  const [isOwnerOperator, setIsOwnerOperator] = useState(driver.is_owner_operator)
  const [cdlNumber, setCdlNumber] = useState(driver.cdl_number ?? '')
  const [cdlState, setCdlState] = useState(driver.cdl_state ?? '')
  const [cdlClass, setCdlClass] = useState(driver.cdl_class ?? '')
  const [hireDate, setHireDate] = useState(driver.hire_date ?? '')
  const [driverStatus, setDriverStatus] = useState<'active' | 'inactive'>(driver.status)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFieldErrors({})
    try {
      const response = await apiFetch<{ driver: RigfileDriver }>(`/api/drivers/${driver.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          is_owner_operator: isOwnerOperator,
          cdl_number: cdlNumber.trim() || null,
          cdl_state: cdlState.trim() ? cdlState.trim().toUpperCase() : null,
          cdl_class: cdlClass || null,
          hire_date: hireDate || null,
          status: driverStatus,
        }),
      })
      onSaved(response.driver)
    } catch (error) {
      if (error instanceof ApiError && error.fields) setFieldErrors(error.fields)
      notify(errorMessage(error), 'error')
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await apiFetch<{ deleted: boolean }>(`/api/drivers/${driver.id}`, { method: 'DELETE' })
      onDeleted()
    } catch (error) {
      notify(errorMessage(error), 'error')
      setDeleting(false)
    }
  }

  return (
    <Modal title="Edit driver" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-first-name" className="block text-sm font-semibold text-slate-700">
              First name
            </label>
            <input id="edit-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} className={`${inputClass} mt-1`} required />
            {fieldErrors.first_name && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{fieldErrors.first_name}</p>}
          </div>
          <div>
            <label htmlFor="edit-last-name" className="block text-sm font-semibold text-slate-700">
              Last name
            </label>
            <input id="edit-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} className={`${inputClass} mt-1`} required />
            {fieldErrors.last_name && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{fieldErrors.last_name}</p>}
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={isOwnerOperator}
            onChange={(event) => setIsOwnerOperator(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
          />
          This driver is me (owner-operator)
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-cdl-number" className="block text-sm font-semibold text-slate-700">
              CDL number
            </label>
            <input id="edit-cdl-number" value={cdlNumber} onChange={(event) => setCdlNumber(event.target.value)} className={`${inputClass} mt-1`} />
            {fieldErrors.cdl_number && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{fieldErrors.cdl_number}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-cdl-state" className="block text-sm font-semibold text-slate-700">
                State
              </label>
              <input id="edit-cdl-state" value={cdlState} onChange={(event) => setCdlState(event.target.value)} placeholder="TX" maxLength={2} className={`${inputClass} mt-1 uppercase`} />
              {fieldErrors.cdl_state && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{fieldErrors.cdl_state}</p>}
            </div>
            <div>
              <label htmlFor="edit-cdl-class" className="block text-sm font-semibold text-slate-700">
                Class
              </label>
              <select id="edit-cdl-class" value={cdlClass} onChange={(event) => setCdlClass(event.target.value)} className={`${inputClass} mt-1`}>
                <option value="">—</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="edit-hire-date" className="block text-sm font-semibold text-slate-700">
              Hire date
            </label>
            <input id="edit-hire-date" type="date" value={hireDate} onChange={(event) => setHireDate(event.target.value)} className={`${inputClass} mt-1`} />
            {fieldErrors.hire_date && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{fieldErrors.hire_date}</p>}
          </div>
          <div>
            <label htmlFor="edit-status" className="block text-sm font-semibold text-slate-700">
              Driver status
            </label>
            <select id="edit-status" value={driverStatus} onChange={(event) => setDriverStatus(event.target.value as 'active' | 'inactive')} className={`${inputClass} mt-1`}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <button type="submit" disabled={saving || !firstName.trim() || !lastName.trim()} className={btnPrimary}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {!confirmingDelete ? (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="text-sm font-semibold text-red-600 hover:text-red-700">
              Remove driver
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Deletes their checklist and audit history.</span>
              <button type="button" onClick={() => void handleDelete()} disabled={deleting} className={btnDanger}>
                {deleting ? 'Removing…' : 'Yes, remove'}
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)} className={btnSecondary}>
                Keep
              </button>
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}

export default function DriverChecklistPage() {
  return (
    <Suspense fallback={<DriverSkeleton />}>
      <DriverChecklist />
    </Suspense>
  )
}
