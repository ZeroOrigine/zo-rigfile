// CANONICAL: /api/dqf-items/[id] — read (GET) and update (PATCH) a single DQF item.
// RigFile computes statuses from dates; clients may only set 'not_applicable'
// (for conditional items) or 'recompute' (to reverse it). When an issue date is
// entered without an expiration, the federal default validity window auto-fills
// the expiration so the operator never has to do CFR math.
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
import { getItemByIdWithType, updateDqfItem } from '@/lib/db/dqf-items'
import { getProfile } from '@/lib/db/profiles'
import {
  DEFAULT_REMINDER_LEAD_DAYS,
  addMonthsToDateString,
  daysUntil,
  effectiveDqfStatus,
} from '@/lib/db/compliance'
import type { RigfileDqfItemWithType } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

interface DqfItemResponse {
  dqf_item: RigfileDqfItemWithType & { days_until_expiration: number | null }
  auto_calculated_expiration?: boolean
  message?: string
}

const itemIdSchema = z.string().uuid({ message: 'That DQF item link looks malformed.' })

const itemNotFoundResponse = () =>
  jsonError("We couldn't find that DQF item — it may belong to a removed driver.", 'NOT_FOUND', 404)

function toItemView(item: RigfileDqfItemWithType, warnDays: number) {
  return {
    ...item,
    status: effectiveDqfStatus(item, warnDays),
    days_until_expiration: item.expires_on ? daysUntil(item.expires_on) : null,
  }
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getAuthenticatedContext()
    if (!context) {
      return unauthorizedResponse()
    }
    const { supabase, user } = context

    const parsedId = itemIdSchema.safeParse(params.id)
    if (!parsedId.success) {
      return zodValidationResponse(parsedId.error)
    }

    // QA-008: fetch item + profile in parallel to avoid sequential round trips.
    const [item, profile] = await Promise.all([
      getItemByIdWithType(supabase, user.id, parsedId.data),
      getProfile(supabase, user.id),
    ])
    if (!item) {
      return itemNotFoundResponse()
    }

    const warnDays = profile?.reminder_lead_days ?? DEFAULT_REMINDER_LEAD_DAYS

    const responseBody: DqfItemResponse = { dqf_item: toItemView(item, warnDays) }
    return jsonData(responseBody)
  } catch (error) {
    return internalErrorResponse('dqf-items.get', error)
  }
}

const dateStringSchema = z
  .string({ invalid_type_error: 'Use the date format YYYY-MM-DD.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date format YYYY-MM-DD.')
  .refine(
    (value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()),
    'That date does not exist — double-check it.'
  )

const updateItemSchema = z
  .object({
    issued_on: dateStringSchema.nullish(),
    expires_on: dateStringSchema.nullish(),
    notes: z
      .string({ invalid_type_error: 'Notes must be text.' })
      .trim()
      .max(2000, 'Notes are capped at 2,000 characters.')
      .nullish(),
    status: z
      .enum(['not_applicable', 'recompute'], {
        errorMap: () => ({
          message:
            "Status can only be set to 'not_applicable' or 'recompute' — RigFile calculates everything else from the dates.",
        }),
      })
      .optional(),
  })
  .strict(
    "That request includes fields we don't recognize. Documents are managed at /api/dqf-items/[id]/document."
  )

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getAuthenticatedContext()
    if (!context) {
      return unauthorizedResponse()
    }
    const { supabase, user } = context

    const parsedId = itemIdSchema.safeParse(params.id)
    if (!parsedId.success) {
      return zodValidationResponse(parsedId.error)
    }

    const parsedBody = await parseJsonBody(request)
    if (!parsedBody.ok) {
      return parsedBody.response
    }
    const parsed = updateItemSchema.safeParse(parsedBody.body)
    if (!parsed.success) {
      return zodValidationResponse(parsed.error)
    }
    if (Object.keys(parsed.data).length === 0) {
      return jsonError('Nothing to update — send at least one field.', 'VALIDATION_ERROR', 400)
    }

    // QA-008: fetch item + profile in parallel to avoid sequential round trips.
    const [currentItem, profile] = await Promise.all([
      getItemByIdWithType(supabase, user.id, parsedId.data),
      getProfile(supabase, user.id),
    ])
    if (!currentItem) {
      return itemNotFoundResponse()
    }

    const updatePayload: Record<string, unknown> = {}
    if ('issued_on' in parsed.data) {
      updatePayload.issued_on = parsed.data.issued_on ?? null
    }
    if ('expires_on' in parsed.data) {
      updatePayload.expires_on = parsed.data.expires_on ?? null
    }
    if ('notes' in parsed.data) {
      updatePayload.notes = parsed.data.notes ?? null
    }
    if (parsed.data.status === 'not_applicable') {
      updatePayload.status = 'not_applicable'
    } else if (parsed.data.status === 'recompute') {
      // The DB trigger recalculates any non-'not_applicable' status from dates.
      updatePayload.status = 'missing'
    }

    // Anticipate the expiration: issue date entered, no expiration anywhere, and
    // the federal item has a default validity window? Fill it in automatically.
    let autoCalculatedExpiration = false
    if (
      'issued_on' in parsed.data &&
      parsed.data.issued_on &&
      !('expires_on' in parsed.data) &&
      !currentItem.expires_on &&
      currentItem.item_type.can_expire &&
      currentItem.item_type.default_validity_months
    ) {
      updatePayload.expires_on = addMonthsToDateString(
        parsed.data.issued_on,
        currentItem.item_type.default_validity_months
      )
      autoCalculatedExpiration = true
    }

    // Cross-field date-order check against the merged (new + existing) values,
    // so the DB constraint never surprises the user with a raw SQL error.
    const nextIssuedOn = ('issued_on' in updatePayload
      ? updatePayload.issued_on
      : currentItem.issued_on) as string | null
    const nextExpiresOn = ('expires_on' in updatePayload
      ? updatePayload.expires_on
      : currentItem.expires_on) as string | null
    if (nextIssuedOn && nextExpiresOn && nextExpiresOn < nextIssuedOn) {
      return jsonError(
        'The expiration date must be on or after the issue date.',
        'VALIDATION_ERROR',
        400,
        { expires_on: 'The expiration date must be on or after the issue date.' }
      )
    }

    const updatedItem = await updateDqfItem(supabase, user.id, parsedId.data, updatePayload)
    if (!updatedItem) {
      return itemNotFoundResponse()
    }

    const warnDays = profile?.reminder_lead_days ?? DEFAULT_REMINDER_LEAD_DAYS

    const responseBody: DqfItemResponse = {
      dqf_item: toItemView(updatedItem, warnDays),
      ...(autoCalculatedExpiration
        ? {
            auto_calculated_expiration: true,
            message: `We set the expiration to ${updatedItem.expires_on} using the ${currentItem.item_type.default_validity_months}-month federal validity window. Adjust it if your document says otherwise.`,
          }
        : {}),
    }
    return jsonData(responseBody)
  } catch (error) {
    return internalErrorResponse('dqf-items.update', error)
  }
}
