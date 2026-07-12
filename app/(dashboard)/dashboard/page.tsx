'use client'

// CANONICAL: RigFile dashboard — live compliance status, fine exposure, drivers,
// what needs attention, and the upcoming deadline calendar. First run walks the
// operator into creating their driver, which instantly seeds all 18 DQF items.
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/modal'
// QA-007: read the shared /api/profile load from the dashboard layout's
// ProfileProvider instead of firing our own duplicate profile request.
import { useProfile } from '../profile-context'
import {
  ApiError,
  apiFetch,
  daysLabel,
  errorMessage,
  expiryPhrase,
  formatDate,
  formatDateTime,
  formatUsd,
  notify,
  triggerDownload,
  PER_VIOLATION_FINE_USD,
  STATUS_LABELS,
  type AuditFileCreateResponse,
  type ComplianceSummary,
  type DeadlineEntry,
  type DriverCreateResponse,
  type DriverSummary,
  type RigfileDqfItemStatus,
  type RigfileDqfItemType,
} from '@/lib/core/api'

const inputClass =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30'
const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'
const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'

const STATUS_DOT: Record<RigfileDqfItemStatus, string> = {
  valid: 'bg-emerald-500',
  expiring_soon: 'bg-amber-500',
  expired: 'bg-red-500',
  missing: 'bg-orange-500',
  not_applicable: 'bg-slate-400',
}

const STATUS_BADGE: Record<RigfileDqfItemStatus, string> = {
  valid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  expiring_soon: 'bg-amber-50 text-amber-800 ring-amber-600/30',
  expired: 'bg-red-50 text-red-700 ring-red-600/30',
  missing: 'bg-orange-50 text-orange-700 ring-orange-600/30',
  not_applicable: 'bg-slate-100 text-slate-500 ring-slate-400/30',
}

function StatusBadge({ status }: { status: RigfileDqfItemStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_BADGE[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

function UpgradeModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Unlock audit-ready PDFs">
      <p className="text-sm leading-relaxed text-slate-600">
        The Solo plan turns your checklist into a stamped, audit-ready DQF PDF — unlimited, whenever an
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
        <button type="button" onClick={onClose} className={btnSecondary}>
          Not now
        </button>
      </div>
    </Modal>
  )
}

interface DriverFormProps {
  defaultOwnerOperator: boolean
  submitLabel: string
  onCreated: (response: DriverCreateResponse) => void
}

function DriverForm({ defaultOwnerOperator, submitLabel, onCreated }: DriverFormProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [isOwnerOperator, setIsOwnerOperator] = useState(defaultOwnerOperator)
  const [showCdl, setShowCdl] = useState(false)
  const [cdlNumber, setCdlNumber] = useState('')
  const [cdlState, setCdlState] = useState('')
  const [cdlClass, setCdlClass] = useState('')
  const [hireDate, setHireDate] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [rootError, setRootError] = useState<string | null>(null)
  const [planLimitHit, setPlanLimitHit] = useState(false)
  const [creating, setCreating] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    setFieldErrors({})
    setRootError(null)
    setPlanLimitHit(false)

    const body: Record<string, unknown> = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      is_owner_operator: isOwnerOperator,
    }
    if (cdlNumber.trim()) body.cdl_number = cdlNumber.trim()
    if (cdlState.trim()) body.cdl_state = cdlState.trim().toUpperCase()
    if (cdlClass) body.cdl_class = cdlClass
    if (hireDate) body.hire_date = hireDate

    try {
      const response = await apiFetch<DriverCreateResponse>('/api/drivers', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      onCreated(response)
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'PLAN_LIMIT_REACHED') setPlanLimitHit(true)
        setFieldErrors(error.fields ?? {})
        setRootError(error.message)
      } else {
        setRootError(errorMessage(error))
      }
      setCreating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="driver-first-name" className="block text-sm font-semibold text-slate-700">
            First name
          </label>
          <input
            id="driver-first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className={`${inputClass} mt-1`}
            autoComplete="given-name"
            required
          />
          {fieldErrors.first_name && (
            <p role="alert" className="mt-1 text-xs font-medium text-red-600">
              {fieldErrors.first_name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="driver-last-name" className="block text-sm font-semibold text-slate-700">
            Last name
          </label>
          <input
            id="driver-last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className={`${inputClass} mt-1`}
            autoComplete="family-name"
            required
          />
          {fieldErrors.last_name && (
            <p role="alert" className="mt-1 text-xs font-medium text-red-600">
              {fieldErrors.last_name}
            </p>
          )}
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

      {!showCdl ? (
        <button
          type="button"
          onClick={() => setShowCdl(true)}
          className="text-sm font-semibold text-blue-700 hover:text-blue-800"
        >
          + Add CDL details now (optional)
        </button>
      ) : (
        <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
          <div>
            <label htmlFor="driver-cdl-number" className="block text-sm font-semibold text-slate-700">
              CDL number
            </label>
            <input
              id="driver-cdl-number"
              value={cdlNumber}
              onChange={(event) => setCdlNumber(event.target.value)}
              className={`${inputClass} mt-1`}
            />
            {fieldErrors.cdl_number && (
              <p role="alert" className="mt-1 text-xs font-medium text-red-600">
                {fieldErrors.cdl_number}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="driver-cdl-state" className="block text-sm font-semibold text-slate-700">
                State
              </label>
              <input
                id="driver-cdl-state"
                value={cdlState}
                onChange={(event) => setCdlState(event.target.value)}
                placeholder="TX"
                maxLength={2}
                className={`${inputClass} mt-1 uppercase`}
              />
              {fieldErrors.cdl_state && (
                <p role="alert" className="mt-1 text-xs font-medium text-red-600">
                  {fieldErrors.cdl_state}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="driver-cdl-class" className="block text-sm font-semibold text-slate-700">
                Class
              </label>
              <select
                id="driver-cdl-class"
                value={cdlClass}
                onChange={(event) => setCdlClass(event.target.value)}
                className={`${inputClass} mt-1`}
              >
                <option value="">—</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="driver-hire-date" className="block text-sm font-semibold text-slate-700">
              Hire date
            </label>
            <input
              id="driver-hire-date"
              type="date"
              value={hireDate}
              onChange={(event) => setHireDate(event.target.value)}
              className={`${inputClass} mt-1`}
            />
            {fieldErrors.hire_date && (
              <p role="alert" className="mt-1 text-xs font-medium text-red-600">
                {fieldErrors.hire_date}
              </p>
            )}
          </div>
        </div>
      )}

      {rootError && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {rootError}
          {planLimitHit && (
            <Link href="/billing" className="ml-1 font-semibold underline">
              See plans →
            </Link>
          )}
        </div>
      )}

      <button type="submit" disabled={creating || !firstName.trim() || !lastName.trim()} className={`${btnPrimary} w-full sm:w-auto`}>
        {creating ? 'Setting up all 18 items…' : submitLabel}
      </button>
    </form>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="skeleton h-9 w-64 rounded-lg" />
      <div className="skeleton h-44 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-72 w-full rounded-2xl" />
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<ComplianceSummary | null>(null)
  const [itemTypes, setItemTypes] = useState<RigfileDqfItemType[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const response = await apiFetch<ComplianceSummary>('/api/compliance/summary')
      setSummary(response)
      if (response.totals.drivers === 0) {
        try {
          const types = await apiFetch<{ item_types: RigfileDqfItemType[] }>('/api/item-types')
          setItemTypes(types.item_types)
        } catch {
          // The preview list is a bonus — the setup form still works without it.
        }
      }
    } catch (error) {
      setLoadError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function handleDriverCreated(response: DriverCreateResponse) {
    notify(response.message, 'success')
    router.push(`/drivers/${response.driver.id}`)
  }

  async function generatePdf(driver: DriverSummary) {
    if (summary && !summary.entitlements.can_generate_audit_pdf) {
      setUpgradeOpen(true)
      return
    }
    setGeneratingFor(driver.id)
    try {
      const response = await apiFetch<AuditFileCreateResponse>('/api/audit-files', {
        method: 'POST',
        body: JSON.stringify({ driver_id: driver.id }),
      })
      if (response.download_url) triggerDownload(response.download_url)
      notify(response.message, response.audit_ready ? 'success' : 'info')
    } catch (error) {
      if (error instanceof ApiError && error.code === 'UPGRADE_REQUIRED') {
        setUpgradeOpen(true)
      } else {
        notify(errorMessage(error), 'error')
      }
    } finally {
      setGeneratingFor(null)
    }
  }

  if (loading) return <DashboardSkeleton />

  if (loadError || !summary) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center animate-fade-up">
        <h1 className="text-xl text-slate-900">We couldn&apos;t load your dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">{loadError ?? 'Give it another try in a moment.'}</p>
        <button type="button" onClick={() => void load()} className={`${btnPrimary} mt-5`}>
          Try again
        </button>
      </div>
    )
  }

  const { totals, entitlements, drivers, needs_attention: needsAttention, upcoming_deadlines: upcomingDeadlines, next_deadline: nextDeadline } = summary

  // ---------- First run: no drivers yet ----------
  if (totals.drivers === 0) {
    return (
      <div className="space-y-8 animate-fade-up">
        <header>
          <h1 className="text-2xl text-slate-900 sm:text-3xl">Let&apos;s build your driver file</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Add yourself as the driver. RigFile instantly sets up all 18 federally required DQF items —
            the exact checklist a DOT auditor works from.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-label="Add your driver" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg text-slate-900">Who&apos;s driving the truck?</h2>
            <p className="mt-1 text-sm text-slate-600">Two fields. Everything else can wait.</p>
            <div className="mt-5">
              <DriverForm defaultOwnerOperator submitLabel="Create my DQF checklist" onCreated={handleDriverCreated} />
            </div>
            <p className="mt-5 rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">
              Fleet software says manual tracking is fine for one driver. A DOT auditor disagrees — the fine
              schedule is identical whether you run 1 truck or 100.
            </p>
          </section>

          <section aria-label="The 18 DQF items" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg text-slate-900">What a DOT auditor asks for</h2>
            <p className="mt-1 text-sm text-slate-600">All 18 items, tracked for you the moment you add a driver.</p>
            <ul className="mt-4 max-h-96 space-y-1.5 overflow-y-auto pr-1">
              {itemTypes.length > 0
                ? itemTypes.map((type) => (
                    <li key={type.id} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm text-slate-700">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                      </svg>
                      <span>
                        {type.name}
                        <span className="ml-1.5 text-xs text-slate-400">{type.cfr_reference}</span>
                      </span>
                    </li>
                  ))
                : [0, 1, 2, 3, 4, 5, 6, 7].map((index) => <li key={index} className="skeleton h-7 rounded-lg" />)}
            </ul>
          </section>
        </div>
      </div>
    )
  }

  // ---------- Normal dashboard ----------
  const violations = totals.expired + totals.missing
  const exposure = violations * PER_VIOLATION_FINE_USD
  const isFreshFile =
    totals.valid + totals.expiring_soon + totals.expired + totals.not_applicable === 0 && totals.missing > 0
  const atDriverLimit = drivers.length >= entitlements.max_drivers

  return (
    <div className="space-y-8">
      <header className="animate-fade-up">
        <h1 className="text-2xl text-slate-900 sm:text-3xl">Your compliance picture</h1>
        <p className="mt-1 text-sm text-slate-500">Live as of {formatDateTime(summary.generated_at)}</p>
      </header>

      {/* Status hero */}
      {totals.audit_ready ? (
        <section
          aria-label="Compliance status"
          className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 text-white shadow-lg animate-fade-up sm:p-8"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 animate-pop">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-9 w-9" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8.3 7.5 9.9 4.3-1.6 7.5-5.3 7.5-9.9v-6L12 2.5Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.7 12 2.4 2.4 4.5-4.6" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl">You&apos;re audit-ready.</h2>
              <p className="mt-1 text-sm leading-relaxed text-emerald-50">
                Nothing expired, nothing missing across {totals.drivers === 1 ? 'your file' : `${totals.drivers} drivers`}.
                If DOT knocks, you&apos;re covered.
                {totals.expiring_soon > 0 &&
                  ` Heads up: ${totals.expiring_soon} item${totals.expiring_soon === 1 ? '' : 's'} renew${totals.expiring_soon === 1 ? 's' : ''} soon.`}
              </p>
            </div>
            {drivers.length === 1 && (
              <button
                type="button"
                onClick={() => void generatePdf(drivers[0])}
                disabled={generatingFor !== null}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 active:scale-[0.98] disabled:opacity-60"
              >
                {generatingFor ? 'Building…' : entitlements.can_generate_audit_pdf ? 'Download audit PDF' : 'Get the audit PDF'}
              </button>
            )}
          </div>
        </section>
      ) : isFreshFile ? (
        <section
          aria-label="Compliance status"
          className="rounded-2xl bg-gradient-to-br from-blue-700 to-blue-800 p-6 text-white shadow-lg animate-fade-up sm:p-8"
        >
          <h2 className="text-2xl">Your checklist is ready — now let&apos;s fill it in.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100">
            {totals.missing} items are waiting for dates. Start with your med card — it&apos;s the single
            most-fined expired document in DOT audits.
          </p>
          {drivers[0] && (
            <Link
              href={`/drivers/${drivers[0].id}`}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 shadow-sm transition-all hover:bg-blue-50 active:scale-[0.98]"
            >
              Open the checklist →
            </Link>
          )}
        </section>
      ) : (
        <section
          aria-label="Compliance status"
          className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm animate-fade-up sm:p-8"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 attention-pulse">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-9 w-9" aria-hidden="true">
                <path strokeLinecap="round" d="M12 9v5m0 3.5v.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl text-slate-900">
                {violations} item{violations === 1 ? '' : 's'} would get flagged in an audit
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {totals.expired > 0 && `${totals.expired} expired`}
                {totals.expired > 0 && totals.missing > 0 && ' · '}
                {totals.missing > 0 && `${totals.missing} missing`}
                {totals.expiring_soon > 0 && ` · ${totals.expiring_soon} expiring soon`}
              </p>
              <p className="mt-3 text-sm font-semibold text-red-700">
                Potential exposure: up to {formatUsd(exposure)}
                <span className="ml-1 font-normal text-slate-500">
                  — DOT fines start at {formatUsd(PER_VIOLATION_FINE_USD)}+ per violation.
                </span>
              </p>
            </div>
            <a href="#attention" className={btnPrimary}>
              Fix it now
            </a>
          </div>
        </section>
      )}

      {nextDeadline && (
        <p className="text-sm text-slate-600 animate-fade-up">
          <span className="font-semibold text-slate-800">Next up:</span> {nextDeadline.item_name}
          {totals.drivers > 1 && ` for ${nextDeadline.driver_name}`} — {formatDate(nextDeadline.expires_on)}{' '}
          {nextDeadline.days_until_expiration !== null && `(${daysLabel(nextDeadline.days_until_expiration)})`}
        </p>
      )}

      {/* Stat chips */}
      <section aria-label="Checklist totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Valid', value: totals.valid, tone: 'text-emerald-600' },
          { label: 'Expiring soon', value: totals.expiring_soon, tone: 'text-amber-600' },
          { label: 'Expired', value: totals.expired, tone: 'text-red-600' },
          { label: 'Missing', value: totals.missing, tone: 'text-orange-600' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className={`font-display text-3xl font-extrabold ${stat.value > 0 ? stat.tone : 'text-slate-300'}`}>
              {stat.value}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
          </div>
        ))}
      </section>

      {/* Drivers */}
      <section aria-label="Drivers">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg text-slate-900">
            Drivers
            <span className="ml-2 text-sm font-normal text-slate-500">
              {drivers.length} of {entitlements.max_drivers} on {entitlements.label}
            </span>
          </h2>
          {!atDriverLimit && (
            <button type="button" onClick={() => setAddOpen(true)} className={btnSecondary}>
              + Add driver
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {drivers.map((driver) => {
            const counts = driver.compliance
            const onFile = counts.total - counts.expired - counts.missing
            const percent = counts.total > 0 ? Math.round((onFile / counts.total) * 100) : 0
            return (
              <article key={driver.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base text-slate-900">
                      {driver.name}
                      {driver.is_owner_operator && (
                        <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">You</span>
                      )}
                      {driver.status === 'inactive' && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Inactive</span>
                      )}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {onFile} of {counts.total} items on file
                    </p>
                  </div>
                  {counts.audit_ready ? (
                    <StatusBadge status="valid" />
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/30">
                      {counts.expired + counts.missing} to fix
                    </span>
                  )}
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${percent}% of items on file`}>
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${counts.audit_ready ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/drivers/${driver.id}`} className={btnPrimary}>
                    Open checklist
                  </Link>
                  <button
                    type="button"
                    onClick={() => void generatePdf(driver)}
                    disabled={generatingFor !== null}
                    className={btnSecondary}
                  >
                    {generatingFor === driver.id ? (
                      'Building…'
                    ) : (
                      <>
                        {!entitlements.can_generate_audit_pdf && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
                            <rect x="5" y="11" width="14" height="9" rx="2" />
                            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                          </svg>
                        )}
                        Audit PDF
                      </>
                    )}
                  </button>
                </div>
              </article>
            )
          })}

          {atDriverLimit && entitlements.plan !== 'fleet' && (
            <Link
              href="/billing"
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 p-5 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/50"
            >
              <p className="text-sm font-semibold text-slate-700">Need more drivers?</p>
              <p className="text-xs text-slate-500">Fleet tracks up to 10 with the same audit protection.</p>
              <span className="text-sm font-semibold text-blue-700">See plans →</span>
            </Link>
          )}
        </div>
      </section>

      {/* Needs attention */}
      <section id="attention" aria-label="Needs attention" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg text-slate-900">Needs your attention</h2>
        </div>
        {needsAttention.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-8 w-8 text-emerald-500" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.5 12.5 2.5 2.5 4.5-5" />
            </svg>
            <p className="text-sm font-semibold text-slate-700">Nothing needs your attention.</p>
            <p className="text-xs text-slate-500">That&apos;s the goal. We&apos;ll flag anything before it becomes a fine.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {needsAttention.slice(0, 8).map((entry) => (
              <li key={entry.dqf_item_id}>
                <Link
                  href={`/drivers/${entry.driver_id}?item=${entry.dqf_item_id}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50"
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[entry.status]}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">{entry.item_name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {totals.drivers > 1 && `${entry.driver_name} · `}
                      {expiryPhrase(entry.expires_on, entry.days_until_expiration)}
                    </span>
                  </span>
                  <StatusBadge status={entry.status} />
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Upcoming deadlines */}
      <section aria-label="Upcoming deadlines" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg text-slate-900">Upcoming deadlines</h2>
        </div>
        {upcomingDeadlines.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-semibold text-slate-700">No dated items yet.</p>
            <p className="mt-1 text-xs text-slate-500">
              Add expiration dates on the checklist and your compliance calendar builds itself.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {upcomingDeadlines.slice(0, 6).map((entry: DeadlineEntry) => {
              const date = entry.expires_on ? new Date(`${entry.expires_on}T00:00:00`) : null
              return (
                <li key={entry.dqf_item_id}>
                  <Link
                    href={`/drivers/${entry.driver_id}?item=${entry.dqf_item_id}`}
                    className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50"
                  >
                    <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-100" aria-hidden="true">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {date ? date.toLocaleDateString('en-US', { month: 'short' }) : '—'}
                      </span>
                      <span className="font-display text-base font-extrabold leading-none text-slate-800">
                        {date ? date.getDate() : ''}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-800">{entry.item_name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {totals.drivers > 1 && `${entry.driver_name} · `}
                        {entry.cfr_reference}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-xs font-semibold ${
                        entry.status === 'expired' ? 'text-red-600' : entry.status === 'expiring_soon' ? 'text-amber-600' : 'text-slate-500'
                      }`}
                    >
                      {daysLabel(entry.days_until_expiration)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {addOpen && (
        <Modal open onClose={() => setAddOpen(false)} title="Add a driver">
          <p className="mb-4 text-sm text-slate-600">
            We&apos;ll set up their full 18-item DQF checklist the moment you save.
          </p>
          <DriverForm defaultOwnerOperator={false} submitLabel="Add driver" onCreated={handleDriverCreated} />
        </Modal>
      )}

      {upgradeOpen && <UpgradeModal onClose={() => setUpgradeOpen(false)} />}
    </div>
  )
}
