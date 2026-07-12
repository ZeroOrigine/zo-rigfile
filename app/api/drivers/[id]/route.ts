// CANONICAL: /api/drivers/[id] — read one driver with their full 18-item DQF
// checklist (GET), update driver details (PATCH), and remove a driver (DELETE).
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
import { deleteDriver, getDriverById, updateDriver } from '@/lib/db/drivers'
import { listItemsWithTypes } from '@/lib/db/dqf-items'
import { getProfile } from '@/lib/db/profiles'
import {
  DEFAULT_REMINDER_LEAD_DAYS,
  daysUntil,
  effectiveDqfStatus,
  isAuditReady,
  summarizeStatuses,
  type ComplianceCounts,
} from '@/lib/db/compliance'
import type { RigfileDriver, RigfileDqfItemWithType } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

interface DqfItemView extends RigfileDqfItemWithType {
  days_until_expiration: number | null
}

interface DriverDetailResponse {
  driver: RigfileDriver
  dqf_items: DqfItemView[]
  compliance: ComplianceCounts & { audit_ready: boolean; reminder_lead_days: number }
}

const driverIdSchema = z.string().uuid({ message: 'That driver link looks malformed.' })

const driverNotFoundResponse = () =>
  jsonError("We couldn't find that driver — it may have been removed.", 'NOT_FOUND', 404)

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getAuthenticatedContext()
    if (!context) {
      return unauthorizedResponse()
    }
    const { supabase, user } = context

    const parsedId = driverIdSchema.safeParse(params.id)
    if (!parsedId.success) {
      return zodValidationResponse(parsedId.error)
    }

    const driver = await getDriverById(supabase, user.id, parsedId.data)
    if (!driver) {
      return driverNotFoundResponse()
    }

    const profile = await getProfile(supabase, user.id)
    const warnDays = profile?.reminder_lead_days ?? DEFAULT_REMINDER_LEAD_DAYS

    const items = await listItemsWithTypes(supabase, user.id, driver.id)
    const itemViews: DqfItemView[] = items
      .map((item) => ({
        ...item,
        status: effectiveDqfStatus(item, warnDays),
        days_until_expiration: item.expires_on ? daysUntil(item.expires_on) : null,
      }))
      .sort((a, b) => a.item_type.sort_order - b.item_type.sort_order)

    const counts = summarizeStatuses(itemViews.map((item) => item.status))

    const responseBody: DriverDetailResponse = {
      driver,
      dqf_items: itemViews,
      compliance: { ...counts, audit_ready: isAuditReady(counts), reminder_lead_days: warnDays },
    }
    return jsonData(responseBody)
  } catch (error) {
    return internalErrorResponse('drivers.get', error)
  }
}

const dateStringSchema = z
  .string({ invalid_type_error: 'Use the date format YYYY-MM-DD.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date format YYYY-MM-DD.')
  .refine(
    (value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()),
    'That date does not exist — double-check it.'
  )

const updateDriverSchema = z
  .object({
    first_name: z
      .string({ invalid_type_error: 'First name must be text.' })
      .trim()
      .min(1, 'First name is required.')
      .max(100, 'Keep the first name under 100 characters.')
      .optional(),
    last_name: z
      .string({ invalid_type_error: 'Last name must be text.' })
      .trim()
      .min(1, 'Last name is required.')
      .max(100, 'Keep the last name under 100 characters.')
      .optional(),
    is_owner_operator: z
      .boolean({ invalid_type_error: 'is_owner_operator must be true or false.' })
      .optional(),
    date_of_birth: dateStringSchema.nullish(),
    hire_date: dateStringSchema.nullish(),
    cdl_number: z
      .string({ invalid_type_error: 'CDL number must be text.' })
      .trim()
      .max(40, 'That CDL number looks too long — double-check it.')
      .nullish(),
    cdl_state: z
      .string({ invalid_type_error: 'CDL state must be text.' })
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, 'CDL state must be the 2-letter code, like TX.')
      .nullish(),
    cdl_class: z
      .enum(['A', 'B', 'C'], { errorMap: () => ({ message: 'CDL class must be A, B, or C.' }) })
      .nullish(),
    status: z
      .enum(['active', 'inactive'], {
        errorMap: () => ({ message: "Driver status must be 'active' or 'inactive'." }),
      })
      .optional(),
  })
  .strict("That request includes fields we don't recognize.")

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getAuthenticatedContext()
    if (!context) {
      return unauthorizedResponse()
    }
    const { supabase, user } = context

    const parsedId = driverIdSchema.safeParse(params.id)
    if (!parsedId.success) {
      return zodValidationResponse(parsedId.error)
    }

    const parsedBody = await parseJsonBody(request)
    if (!parsedBody.ok) {
      return parsedBody.response
    }
    const parsed = updateDriverSchema.safeParse(parsedBody.body)
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

    const driver = await updateDriver(supabase, user.id, parsedId.data, updatePayload)
    if (!driver) {
      return driverNotFoundResponse()
    }

    return jsonData({ driver })
  } catch (error) {
    return internalErrorResponse('drivers.update', error)
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getAuthenticatedContext()
    if (!context) {
      return unauthorizedResponse()
    }
    const { supabase, user } = context

    const parsedId = driverIdSchema.safeParse(params.id)
    if (!parsedId.success) {
      return zodValidationResponse(parsedId.error)
    }

    const deleted = await deleteDriver(supabase, user.id, parsedId.data)
    if (!deleted) {
      return driverNotFoundResponse()
    }

    return jsonData({
      deleted: true,
      id: parsedId.data,
      message: 'Driver removed. Their DQF checklist and audit history were removed with them.',
    })
  } catch (error) {
    return internalErrorResponse('drivers.delete', error)
  }
}
