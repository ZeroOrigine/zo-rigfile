// CANONICAL: /api/profile — operator profile (GET) and settings updates (PATCH).
// reminder_lead_days here drives the 'expiring_soon' window everywhere: the DB
// trigger, the daily cron, and every live recompute in the API read it.
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedContext } from '@/lib/supabase/server'
import {
  internalErrorResponse,
  jsonData,
  jsonError,
  parseJsonBody,
  unauthorizedResponse,
  zodValidationResponse,
} from '@/lib/db/api-helpers'
import { ensureProfile, updateProfile } from '@/lib/db/profiles'
import { getEntitlements, type Entitlements } from '@/lib/db/entitlements'
import type { RigfileProfile } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

interface ProfileResponse {
  profile: RigfileProfile
  entitlements: Entitlements
  message?: string
}

export async function GET(_request: NextRequest) {
  try {
    const context = await getAuthenticatedContext()
    if (!context) {
      return unauthorizedResponse()
    }
    const { supabase, user } = context

    const profile = await ensureProfile(supabase, user.id, user.email ?? null)
    const entitlements = await getEntitlements(supabase, user.id)

    const responseBody: ProfileResponse = { profile, entitlements }
    return jsonData(responseBody)
  } catch (error) {
    return internalErrorResponse('profile.get', error)
  }
}

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

const updateProfileSchema = z
  .object({
    full_name: z
      .string({ invalid_type_error: 'Name must be text.' })
      .trim()
      .max(120, 'Keep the name under 120 characters.')
      .optional(),
    company_name: z
      .string({ invalid_type_error: 'Company name must be text.' })
      .trim()
      .max(160, 'Keep the company name under 160 characters.')
      .nullish(),
    dot_number: z
      .string({ invalid_type_error: 'USDOT number must be text (leading zeros matter).' })
      .trim()
      .min(1, 'Enter the USDOT number, or send null to clear it.')
      .max(12, 'That USDOT number looks too long — double-check it.')
      .regex(/^\d+$/, 'USDOT numbers contain only digits.')
      .nullish(),
    mc_number: z
      .string({ invalid_type_error: 'MC number must be text.' })
      .trim()
      .min(1, 'Enter the MC number, or send null to clear it.')
      .max(12, 'That MC number looks too long — double-check it.')
      .regex(/^\d+$/, 'MC numbers contain only digits.')
      .nullish(),
    phone: z
      .string({ invalid_type_error: 'Phone must be text.' })
      .trim()
      .max(30, 'Keep the phone number under 30 characters.')
      .nullish(),
    timezone: z
      .string({ invalid_type_error: 'Timezone must be text.' })
      .trim()
      .min(1, 'Timezone is required when provided.')
      .max(60, 'That timezone name looks too long.')
      .refine(isValidTimezone, 'That timezone is not recognized — use an IANA name like America/Chicago.')
      .optional(),
    reminder_lead_days: z
      .number({ invalid_type_error: 'Reminder lead time must be a number of days.' })
      .int('Use a whole number of days.')
      .min(1, 'Reminder lead time must be at least 1 day.')
      .max(365, 'Reminder lead time is capped at 365 days.')
      .optional(),
  })
  .strict("That request includes fields we don't recognize.")

export async function PATCH(request: NextRequest) {
  try {
    const context = await getAuthenticatedContext()
    if (!context) {
      return unauthorizedResponse()
    }
    const { supabase, user } = context

    const parsedBody = await parseJsonBody(request)
    if (!parsedBody.ok) {
      return parsedBody.response
    }
    const parsed = updateProfileSchema.safeParse(parsedBody.body)
    if (!parsed.success) {
      return zodValidationResponse(parsed.error)
    }

    const updatePayload: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed.data as Record<string, unknown>)) {
      if (value !== undefined) {
        updatePayload[key] = value
      }
    }
    if (Object.keys(updatePayload).length === 0) {
      return jsonError('Nothing to update — send at least one field.', 'VALIDATION_ERROR', 400)
    }

    // Make sure the row exists before updating (repairs a missed signup trigger).
    await ensureProfile(supabase, user.id, user.email ?? null)

    const profile = await updateProfile(supabase, user.id, updatePayload)
    if (!profile) {
      return jsonError("We couldn't find your profile. Sign out and back in, then try again.", 'NOT_FOUND', 404)
    }

    const entitlements = await getEntitlements(supabase, user.id)

    const responseBody: ProfileResponse = {
      profile,
      entitlements,
      ...(parsed.data.reminder_lead_days !== undefined
        ? {
            message: `Got it — you'll now see items flagged ${profile.reminder_lead_days} days before they expire.`,
          }
        : {}),
    }
    return jsonData(responseBody)
  } catch (error) {
    return internalErrorResponse('profile.update', error)
  }
}
