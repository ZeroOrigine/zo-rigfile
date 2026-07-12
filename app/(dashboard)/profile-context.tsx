'use client'

// Shared profile context for the dashboard shell.
// Loads the signed-in operator's profile once from /api/profile and exposes
// it to dashboard pages (settings, billing, nav header, etc.).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { RigfileProfile } from '@/lib/db/types'

// Back-compat alias: the profile payload returned by /api/profile is just the
// canonical RigfileProfile row. (lib/db/types does not export a separate
// ProfileResponse type.)
export type ProfileResponse = RigfileProfile

export interface ProfileContextValue {
  profile: RigfileProfile | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  setProfile: (profile: RigfileProfile | null) => void
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined)

function extractProfile(payload: unknown): RigfileProfile | null {
  if (!payload || typeof payload !== 'object') return null
  const record = payload as Record<string, unknown>
  if (record.data && typeof record.data === 'object') {
    return record.data as RigfileProfile
  }
  if (record.profile && typeof record.profile === 'object') {
    return record.profile as RigfileProfile
  }
  if (typeof record.id === 'string') {
    return record as unknown as RigfileProfile
  }
  return null
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<RigfileProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/profile', { cache: 'no-store' })
      if (!res.ok) {
        throw new Error(`Failed to load profile (${res.status})`)
      }
      const payload = (await res.json()) as unknown
      setProfile(extractProfile(payload))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<ProfileContextValue>(
    () => ({ profile, loading, error, refresh, setProfile }),
    [profile, loading, error, refresh]
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext)
  if (!ctx) {
    throw new Error('useProfile must be used within a ProfileProvider')
  }
  return ctx
}

export default ProfileProvider
