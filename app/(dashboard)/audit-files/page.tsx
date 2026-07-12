'use client'

// CANONICAL: Audit PDFs — the record of every generated audit-ready DQF file,
// with one-click regeneration and fresh signed downloads.
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ApiError,
  apiFetch,
  errorMessage,
  formatDateTime,
  formatUsd,
  notify,
  triggerDownload,
  PER_VIOLATION_FINE_USD,
  type AuditFileCreateResponse,
  type AuditFileDetailResponse,
  type AuditFileListResponse,
  type DriverListResponse,
  type DriverWithCompliance,
  type Entitlements,
  type PaginationMeta,
  type ProfileResponse,
  type RigfileAuditFile,
} from '@/lib/core/api'

const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'
const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'
const inputClass =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30'

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-fade-up">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="skeleton h-9 w-52 rounded-lg" />
      <div className="skeleton h-20 w-full rounded-2xl" />
      <div className="space-y-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="skeleton h-16 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export default function AuditFilesPage() {
  const [files, setFiles] = useState<RigfileAuditFile[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [page, setPage] = useState(1)
  const [drivers, setDrivers] = useState<DriverWithCompliance[]>([])
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)
  const [listLoading, setListLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const loadList = useCallback(async (targetPage: number) => {
    setListLoading(true)
    try {
      const response = await apiFetch<AuditFileListResponse>(`/api/audit-files?page=${targetPage}&limit=10`)
      setFiles(response.audit_files)
      setPagination(response.pagination)
      setLoadError(null)
    } catch (error) {
      setLoadError(errorMessage(error))
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        const [listResponse, driversResponse, profileResponse] = await Promise.all([
          apiFetch<AuditFileListResponse>('/api/audit-files?page=1&limit=10'),
          apiFetch<DriverListResponse>('/api/drivers?limit=20').catch(() => null),
          apiFetch<ProfileResponse>('/api/profile').catch(() => null),
        ])
        if (cancelled) return
        setFiles(listResponse.audit_files)
        setPagination(listResponse.pagination)
        if (driversResponse) {
          setDrivers(driversResponse.drivers)
          if (driversResponse.drivers[0]) setSelectedDriverId(driversResponse.drivers[0].id)
        }
        if (profileResponse) setEntitlements(profileResponse.entitlements)
      } catch (error) {
        if (!cancelled) setLoadError(errorMessage(error))
      } finally {
        if (!cancelled) setInitialLoading(false)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!initialLoading) void loadList(page)
  }, [page, initialLoading, loadList])

  async function handleGenerate() {
    if (entitlements && !entitlements.can_generate_audit_pdf) {
      setUpgradeOpen(true)
      return
    }
    if (!selectedDriverId) return
    setGenerating(true)
    try {
      const response = await apiFetch<AuditFileCreateResponse>('/api/audit-files', {
        method: 'POST',
        body: JSON.stringify({ driver_id: selectedDriverId }),
      })
      if (response.download_url) triggerDownload(response.download_url)
      notify(response.message, response.audit_ready ? 'success' : 'info')
      if (page === 1) {
        await loadList(1)
      } else {
        setPage(1)
      }
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

  async function handleDownload(fileId: string) {
    setDownloadingId(fileId)
    try {
      const response = await apiFetch<AuditFileDetailResponse>(`/api/audit-files/${fileId}`)
      if (response.download_url) {
        triggerDownload(response.download_url)
        notify('Download started — the link is good for 10 minutes.', 'success')
      } else {
        notify("That file's PDF isn't in storage anymore. Generate a fresh one — it takes seconds.", 'error')
      }
    } catch (error) {
      notify(errorMessage(error), 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  if (initialLoading) return <ListSkeleton />

  const totalPages = pagination?.total_pages ?? 0

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="text-2xl text-slate-900 sm:text-3xl">Audit PDFs</h1>
        <p className="mt-1 text-sm text-slate-600">
          Every file is a point-in-time record of your DQF — exactly what you hand an auditor.
        </p>
      </header>

      {/* Generate bar */}
      <section aria-label="Generate a new audit PDF" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-fade-up">
        {drivers.length === 0 ? (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">Add a driver first — the PDF is built from their 18-item checklist.</p>
            <Link href="/dashboard" className={btnPrimary}>
              Set up your driver
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {drivers.length > 1 && (
              <div className="flex-1">
                <label htmlFor="generate-driver" className="block text-sm font-semibold text-slate-700">
                  Driver
                </label>
                <select
                  id="generate-driver"
                  value={selectedDriverId}
                  onChange={(event) => setSelectedDriverId(event.target.value)}
                  className={`${inputClass} mt-1`}
                >
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.first_name} {driver.last_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button type="button" onClick={() => void handleGenerate()} disabled={generating || !selectedDriverId} className={`${btnPrimary} sm:min-w-56`}>
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
                  {drivers.length === 1 ? `Generate PDF for ${drivers[0].first_name}` : 'Generate audit PDF'}
                </>
              )}
            </button>
          </div>
        )}
      </section>

      {loadError && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {loadError}
          <button type="button" onClick={() => void loadList(page)} className="ml-2 font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {/* History */}
      <section aria-label="Generated audit files" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {listLoading ? (
          <div className="space-y-2 p-4" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <div key={index} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="relative h-20 w-16 rounded-lg border-2 border-slate-200 bg-slate-50 p-2" aria-hidden="true">
              <div className="h-1.5 w-8 rounded bg-slate-300" />
              <div className="mt-1.5 h-1 w-10 rounded bg-slate-200" />
              <div className="mt-1 h-1 w-9 rounded bg-slate-200" />
              <div className="mt-1 h-1 w-10 rounded bg-slate-200" />
              <div className="absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3 w-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                </svg>
              </div>
            </div>
            <p className="text-sm font-semibold text-slate-700">No audit PDFs yet</p>
            <p className="max-w-md text-xs leading-relaxed text-slate-500">
              Each PDF captures all 18 items with statuses, dates, and a certification block — a permanent record
              that this file was in order on that day. One expired document at audit starts at{' '}
              {formatUsd(PER_VIOLATION_FINE_USD)}+.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {files.map((file) => {
              const flagged = file.items_expired + file.items_missing
              return (
                <li key={file.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 sm:flex" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 3h6l4 4v14H8zM14 3v4h4M10.5 12.5h5M10.5 16h5" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800" title={file.file_name}>
                      {file.file_name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {file.driver_name} · {formatDateTime(file.created_at)} · {file.items_valid}/{file.items_total} valid
                    </p>
                  </div>
                  {flagged === 0 ? (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                      Audit ready
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/30">
                      {flagged} flagged
                    </span>
                  )}
                  <button type="button" onClick={() => void handleDownload(file.id)} disabled={downloadingId !== null} className={btnSecondary}>
                    {downloadingId === file.id ? (
                      'Preparing…'
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0 4-4m-4 4-4-4M4 19h16" />
                        </svg>
                        Download
                      </>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <nav aria-label="Audit file pages" className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || listLoading} className={btnSecondary}>
              ← Newer
            </button>
            <p className="text-xs font-medium text-slate-500">
              Page {page} of {totalPages}
            </p>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || listLoading} className={btnSecondary}>
              Older →
            </button>
          </nav>
        )}
      </section>

      {upgradeOpen && (
        <Modal title="Unlock audit-ready PDFs" onClose={() => setUpgradeOpen(false)}>
          <p className="text-sm leading-relaxed text-slate-600">
            The Solo plan turns your checklist into a stamped, audit-ready DQF PDF — unlimited, whenever an
            officer asks for it. Your compliance calendar stays free forever.
          </p>
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            One expired med card can mean a {formatUsd(PER_VIOLATION_FINE_USD)}+ fine at audit. Solo exists so that
            never happens.
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
    </div>
  )
}
