'use client'

// CANONICAL: Settings — carrier identity (printed on every audit PDF), the
// expiration reminder window, and timezone.
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  ApiError,
  apiFetch,
  errorMessage,
  notify,
  type ProfileResponse,
  type RigfileProfile,
} from '@/lib/core/api'

const inputClass =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30'
const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'

const US_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
]

const QUICK_REMINDER_DAYS = [14, 30, 60, 90]

function SettingsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="skeleton h-9 w-44 rounded-lg" />
      <div className="skeleton h-72 w-full rounded-2xl" />
      <div className="skeleton h-44 w-full rounded-2xl" />
    </div>
  )
}

export default function SettingsPage() {
  const [account, setAccount] = useState<ProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [dotNumber, setDotNumber] = useState('')
  const [mcNumber, setMcNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [timezone, setTimezone] = useState('America/Chicago')
  const [reminderDays, setReminderDays] = useState(30)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiFetch<ProfileResponse>('/api/profile')
      .then((response) => {
        if (cancelled) return
        setAccount(response)
        seedForm(response.profile)
      })
      .catch((error) => {
        if (!cancelled) setLoadError(errorMessage(error))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }

    function seedForm(profile: RigfileProfile) {
      setFullName(profile.full_name ?? '')
      setCompanyName(profile.company_name ?? '')
      setDotNumber(profile.dot_number ?? '')
      setMcNumber(profile.mc_number ?? '')
      setPhone(profile.phone ?? '')
      setTimezone(profile.timezone ?? 'America/Chicago')
      setReminderDays(profile.reminder_lead_days ?? 30)
    }
  }, [])

  const payload = useMemo(() => {
    if (!account) return {}
    const profile = account.profile
    const next: Record<string, unknown> = {}
    if (fullName.trim() !== profile.full_name) next.full_name = fullName.trim()
    if ((companyName.trim() || null) !== profile.company_name) next.company_name = companyName.trim() || null
    if ((dotNumber.trim() || null) !== profile.dot_number) next.dot_number = dotNumber.trim() || null
    if ((mcNumber.trim() || null) !== profile.mc_number) next.mc_number = mcNumber.trim() || null
    if ((phone.trim() || null) !== profile.phone) next.phone = phone.trim() || null
    if (timezone !== profile.timezone) next.timezone = timezone
    if (reminderDays !== profile.reminder_lead_days) next.reminder_lead_days = reminderDays
    return next
  }, [account, fullName, companyName, dotNumber, mcNumber, phone, timezone, reminderDays])

  const isDirty = Object.keys(payload).length > 0

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isDirty) return
    setSaving(true)
    setFieldErrors({})
    try {
      const response = await apiFetch<ProfileResponse>('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setAccount(response)
      notify(response.message ?? 'Settings saved.', 'success')
    } catch (error) {
      if (error instanceof ApiError && error.fields) setFieldErrors(error.fields)
      notify(errorMessage(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SettingsSkeleton />

  if (loadError || !account) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center animate-fade-up">
        <h1 className="text-xl text-slate-900">We couldn&apos;t load your settings</h1>
        <p className="mt-2 text-sm text-slate-600">{loadError ?? 'Give it another try in a moment.'}</p>
      </div>
    )
  }

  const timezoneOptions = US_TIMEZONES.includes(timezone) ? US_TIMEZONES : [timezone, ...US_TIMEZONES]

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="text-2xl text-slate-900 sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your carrier details print on the header of every audit PDF — an auditor sees them first.
        </p>
      </header>

      <form onSubmit={handleSave} className="space-y-6" noValidate>
        <section aria-label="Carrier information" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-fade-up">
          <h2 className="text-lg text-slate-900">Carrier information</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="settings-name" className="block text-sm font-semibold text-slate-700">
                Your name
              </label>
              <input id="settings-name" value={fullName} onChange={(event) => setFullName(event.target.value)} className={`${inputClass} mt-1`} autoComplete="name" />
              {fieldErrors.full_name && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{fieldErrors.full_name}</p>}
            </div>
            <div>
              <label htmlFor="settings-company" className="block text-sm font-semibold text-slate-700">
                Company name
              </label>
              <input id="settings-company" value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="e.g. Big Sky Hauling LLC" className={`${inputClass} mt-1`} autoComplete="organization" />
              {fieldErrors.company_name && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{fieldErrors.company_name}</p>}
            </div>
            <div>
              <label htmlFor="settings-dot" className="block text-sm font-semibold text-slate-700">
                USDOT number
              </label>
              <input id="settings-dot" value={dotNumber} onChange={(event) => setDotNumber(event.target.value)} inputMode="numeric" placeholder="Digits only" className={`${inputClass} mt-1`} />
              {fieldErrors.dot_number && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{fieldErrors.dot_number}</p>}
            </div>
            <div>
              <label htmlFor="settings-mc" className="block text-sm font-semibold text-slate-700">
                MC number
              </label>
              <input id="settings-mc" value={mcNumber} onChange={(event) => setMcNumber(event.target.value)} inputMode="numeric" placeholder="Digits only" className={`${inputClass} mt-1`} />
              {fieldErrors.mc_number && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{fieldErrors.mc_number}</p>}
            </div>
            <div>
              <label htmlFor="settings-phone" className="block text-sm font-semibold text-slate-700">
                Phone
              </label>
              <input id="settings-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={`${inputClass} mt-1`} autoComplete="tel" />
              {fieldErrors.phone && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{fieldErrors.phone}</p>}
            </div>
            <div>
              <label htmlFor="settings-timezone" className="block text-sm font-semibold text-slate-700">
                Timezone
              </label>
              <select id="settings-timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} className={`${inputClass} mt-1`}>
                {timezoneOptions.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace('_', ' ')}
                  </option>
                ))}
              </select>
              {fieldErrors.timezone && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{fieldErrors.timezone}</p>}
            </div>
          </div>
        </section>

        <section aria-label="Reminder window" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-fade-up">
          <h2 className="text-lg text-slate-900">Expiration warnings</h2>
          <p className="mt-1 text-sm text-slate-600">
            We&apos;ll flag any item as “expiring soon” this many days before its date.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {QUICK_REMINDER_DAYS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setReminderDays(days)}
                aria-pressed={reminderDays === days}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  reminderDays === days ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {days} days
              </button>
            ))}
            <div className="flex items-center gap-2">
              <label htmlFor="settings-reminder" className="text-sm font-medium text-slate-600">
                Custom:
              </label>
              <input
                id="settings-reminder"
                type="number"
                min={1}
                max={365}
                value={reminderDays}
                onChange={(event) => {
                  const parsed = Number.parseInt(event.target.value, 10)
                  if (Number.isFinite(parsed)) setReminderDays(Math.min(365, Math.max(1, parsed)))
                }}
                className={`${inputClass} w-24`}
              />
            </div>
          </div>
          {fieldErrors.reminder_lead_days && (
            <p role="alert" className="mt-2 text-xs font-medium text-red-600">{fieldErrors.reminder_lead_days}</p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            30 days is the sweet spot for most operators — enough time to book a DOT physical or pull an MVR.
          </p>
        </section>

        <div className="flex items-center gap-4">
          <button type="submit" disabled={!isDirty || saving} className={btnPrimary}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          {!isDirty && <p className="text-xs text-slate-500">Everything&apos;s saved.</p>}
        </div>
      </form>

      <section aria-label="Plan" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-fade-up">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg text-slate-900">Your plan</h2>
            <p className="mt-1 text-sm text-slate-600">
              You&apos;re on <span className="font-semibold">{account.entitlements.label}</span> — up to{' '}
              {account.entitlements.max_drivers} driver{account.entitlements.max_drivers === 1 ? '' : 's'},{' '}
              {account.entitlements.can_generate_audit_pdf ? 'audit PDFs included' : 'calendar only'}.
            </p>
          </div>
          <Link href="/billing" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
            Manage plan →
          </Link>
        </div>
      </section>
    </div>
  )
}
