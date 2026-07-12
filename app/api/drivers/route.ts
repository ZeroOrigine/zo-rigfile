// CANONICAL: /api/drivers — list drivers with live compliance rollups (GET) and
// create a driver (POST). Creating a driver auto-seeds all 18 DQF items via the
// DB trigger, so the checklist is never empty.
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedContext } from '@/lib/supabase/server'
import {
  buildPaginationMeta,
  internalErrorResponse,
  jsonData,
  jsonError,
  parseJsonBody,
  parsePagination,
  unauthorizedResponse,
  zodValidationResponse,
} from '@/lib/db/api-helpers'
import { countDrivers, createDriver, listDrivers } from '@/lib/db/drivers'
import { listItemStatusRows } from '@/lib/db/dqf-items'
import { getEntitlements } from '@/lib/db/entitlements'
import { getProfile } from '@/lib/db/profiles'
import {
  DEFAULT_REMINDER_LEAD_DAYS,
  effectiveDqfStatus,
  isAuditReady,
  summarizeStatuses,
  type ComplianceCounts,
} from '@/lib/db/compliance'
import type { PaginationMeta, RigfileDriver, RigfileDqfItemStatus } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

interface DriverWithCompliance extends RigfileDriver {
  compliance: ComplianceCounts & { audit_ready: boolean }
}

interface DriverListResponse {
  drivers: DriverWithCompliance[]
  pagination: PaginationMeta
}

interface DriverCreateResponse {
  driver: RigfileDriver
  dqf_items_seeded: number
  message: string
}

const listQuerySchema = z.object({
  status: z
    .enum(['active', 'inactive'], {
      errorMap: () => ({ message: "Status filter must be 'active' or 'inactive'." }),
    })
    .optional(),
})

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthenticatedContext()
    if (!context) {
      return unauthorizedResponse()
    }
    const { supabase, user } = context

    const { searchParams } = new URL(request.url)
    const pagination = parsePagination(searchParams)

    const rawQuery: Record<string, string> = {}
    const statusParam = searchParams.get('status')
    if (statusParam) {
      rawQuery.status = statusParam
    }
    const parsedQuery = listQuerySchema.safeParse(rawQuery)
    if (!parsedQuery.success) {
      return zodValidationResponse(parsedQuery.error)
    }

    const { drivers, total } = await listDrivers(supabase, user.id, {
      status: parsedQuery.data.status ?? null,
      from: pagination.from,
      to: pagination.to,
    })

    const profile = await getProfile(supabase, user.id)
    const warnDays = profile?.reminder_lead_days ?? DEFAULT_REMINDER_LEAD_DAYS

    const statusRows = await listItemStatusRows(
      supabase,
      user.id,
      drivers.map((driver) => driver.id)
    )

    const statusesByDriver = new Map<string, RigfileDqfItemStatus[]>()
    for (const row of statusRows) {
      const statuses = statusesByDriver.get(row.driver_id) ?? []
      statuses.push(effectiveDqfStatus(row, warnDays))
      statusesByDriver.set(row.driver_id, statuses)
    }

    const driversWithCompliance: DriverWithCompliance[] = drivers.map((driver) => {
      const counts = summarizeStatuses(statusesByDriver.get(driver.id) ?? [])
      return { ...driver, compliance: { ...counts, audit_ready: isAuditReady(counts) } }
    })

    const responseBody: DriverListResponse = {
      drivers: driversWithCompliance,
      pagination: buildPaginationMeta(pagination.page, pagination.limit, total),
    }
    return jsonData(responseBody)
  } catch (error) {
    return internalErrorResponse('drivers.list', error)
  }
}

const dateStringSchema = z
  .string({ invalid_type_error: 'Use the date format YYYY-MM-DD.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date format YYYY-MM-DD.')
  .refine(
    (value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()),
    'That date does not exist — double-check it.'
  )

const createDriverSchema = z
  .object({
    first_name: z
      .string({ required_error: 'First name is required.', invalid_type_error: 'First name must be text.' })
      .trim()
      .min(1, 'First name is required.')
      .max(100, 'Keep the first name under 100 characters.'),
    last_name: z
      .string({ required_error: 'Last name is required.', invalid_type_error: 'Last name must be text.' })
      .trim()
      .min(1, 'Last name is required.')
      .max(100, 'Keep the last name under 100 characters.'),
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
  })
  .strict("That request includes fields we don't recognize.")

export async function POST(request: NextRequest) {
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
    const parsed = createDriverSchema.safeParse(parsedBody.body)
    if (!parsed.success) {
      return zodValidationResponse(parsed.error)
    }

    // Plan enforcement: free = 1 driver, solo = 1 driver, fleet = up to 10.
    const entitlements = await getEntitlements(supabase, user.id)
    const existingDriverCount = await countDrivers(supabase, user.id)
    if (existingDriverCount >= entitlements.max_drivers) {
      const message =
        entitlements.plan === 'fleet'
          ? `The Fleet plan covers up to ${entitlements.max_drivers} drivers and you've reached that limit. Remove a driver you no longer run before adding a new one.`
          : `The ${entitlements.label} plan covers 1 driver. Upgrade to Fleet to track up to 10 drivers with the same audit protection.`
      return jsonError(message, 'PLAN_LIMIT_REACHED', 403)
    }

    const input = parsed.data
    const driver = await createDriver(supabase, user.id, {
      first_name: input.first_name,
      last_name: input.last_name,
      is_owner_operator: input.is_owner_operator ?? false,
      date_of_birth: input.date_of_birth ?? null,
      hire_date: input.hire_date ?? null,
      cdl_number: input.cdl_number ?? null,
      cdl_state: input.cdl_state ?? null,
      cdl_class: input.cdl_class ?? null,
    })

    const responseBody: DriverCreateResponse = {
      driver,
      dqf_items_seeded: 18,
      message: `${driver.first_name}'s DQF checklist is ready — all 18 federal items are set up and waiting for dates.`,
    }
    return jsonData(responseBody, 201)
  } catch (error) {
    return internalErrorResponse('drivers.create', error)
  }
}
