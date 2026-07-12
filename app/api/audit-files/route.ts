// CANONICAL: /api/audit-files — the core product action.
//   GET  -> list generated audit files (paginated, newest first)
//   POST -> generate an audit-ready DQF PDF for a driver: recompute every item
//           status at this instant, render the PDF, store it, and log an
//           immutable snapshot in rigfile_audit_files.
// Plan gate: free = calendar only; solo and fleet generate unlimited PDFs.
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
import { getDriverById } from '@/lib/db/drivers'
import { listItemsWithTypes } from '@/lib/db/dqf-items'
import { insertAuditFile, listAuditFiles } from '@/lib/db/audit-files'
import { ensureProfile } from '@/lib/db/profiles'
import { getEntitlements } from '@/lib/db/entitlements'
import {
  DEFAULT_REMINDER_LEAD_DAYS,
  effectiveDqfStatus,
  isAuditReady,
  summarizeStatuses,
} from '@/lib/db/compliance'
import {
  buildAuditFileName,
  buildAuditPdf,
  formatTimestampForTimezone,
  type AuditPdfItem,
} from '@/lib/db/pdf'
import {
  buildAuditPdfStoragePath,
  createSignedDownloadUrl,
  removeStorageObject,
  uploadPdfToStorage,
} from '@/lib/supabase/storage'
import type {
  AuditSnapshotItem,
  PaginationMeta,
  RigfileAuditFile,
  RigfileAuditFileDetail,
  RigfileDriver,
} from '@/lib/db/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DOWNLOAD_URL_TTL_SECONDS = 600

interface AuditFileListResponse {
  audit_files: RigfileAuditFile[]
  pagination: PaginationMeta
}

interface AuditFileCreateResponse {
  audit_file: RigfileAuditFileDetail
  download_url: string | null
  download_url_expires_in_seconds: number
  audit_ready: boolean
  message: string
}

const listQuerySchema = z.object({
  driver_id: z.string().uuid('driver_id must be a valid driver ID.').optional(),
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
    const driverIdParam = searchParams.get('driver_id')
    if (driverIdParam) {
      rawQuery.driver_id = driverIdParam
    }
    const parsedQuery = listQuerySchema.safeParse(rawQuery)
    if (!parsedQuery.success) {
      return zodValidationResponse(parsedQuery.error)
    }

    const { auditFiles, total } = await listAuditFiles(supabase, user.id, {
      driverId: parsedQuery.data.driver_id,
      from: pagination.from,
      to: pagination.to,
    })

    const responseBody: AuditFileListResponse = {
      audit_files: auditFiles,
      pagination: buildPaginationMeta(pagination.page, pagination.limit, total),
    }
    return jsonData(responseBody)
  } catch (error) {
    return internalErrorResponse('audit-files.list', error)
  }
}

const generateSchema = z
  .object({
    driver_id: z
      .string({ required_error: 'driver_id is required.', invalid_type_error: 'driver_id must be text.' })
      .uuid('driver_id must be a valid driver ID.'),
  })
  .strict("That request includes fields we don't recognize.")

function buildCdlSummary(driver: RigfileDriver): string | null {
  if (!driver.cdl_number && !driver.cdl_state && !driver.cdl_class) {
    return null
  }
  const details = [driver.cdl_state, driver.cdl_class ? `Class ${driver.cdl_class}` : null]
    .filter(Boolean)
    .join(', ')
  return `CDL ${driver.cdl_number ?? 'on file'}${details ? ` (${details})` : ''}`
}

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
    const parsed = generateSchema.safeParse(parsedBody.body)
    if (!parsed.success) {
      return zodValidationResponse(parsed.error)
    }

    // Plan gate — free is calendar-only by design.
    const entitlements = await getEntitlements(supabase, user.id)
    if (!entitlements.can_generate_audit_pdf) {
      return jsonError(
        'Audit PDF generation is part of the Solo plan. Your compliance calendar keeps working free forever — upgrade when you need the audit-ready file.',
        'UPGRADE_REQUIRED',
        403
      )
    }

    const driver = await getDriverById(supabase, user.id, parsed.data.driver_id)
    if (!driver) {
      return jsonError("We couldn't find that driver — it may have been removed.", 'NOT_FOUND', 404)
    }

    const profile = await ensureProfile(supabase, user.id, user.email ?? null)
    const warnDays = profile.reminder_lead_days ?? DEFAULT_REMINDER_LEAD_DAYS

    const items = await listItemsWithTypes(supabase, user.id, driver.id)
    if (items.length === 0) {
      return jsonError(
        "This driver's DQF checklist hasn't been set up yet. Open the driver page once to initialize it, then try again.",
        'CONFLICT',
        409
      )
    }

    const sortedItems = [...items].sort((a, b) => a.item_type.sort_order - b.item_type.sort_order)

    // Point-in-time truth: recompute every status right now, never trust a
    // column that may be a day stale. An audit PDF must be exact.
    const generatedAt = new Date()
    const snapshot: AuditSnapshotItem[] = sortedItems.map((item) => ({
      item_type_code: item.item_type.code,
      item_type_name: item.item_type.name,
      cfr_reference: item.item_type.cfr_reference,
      sort_order: item.item_type.sort_order,
      status: effectiveDqfStatus(item, warnDays),
      issued_on: item.issued_on,
      expires_on: item.expires_on,
      has_document: item.document_path !== null,
      document_name: item.document_name,
      notes: item.notes,
    }))

    const counts = summarizeStatuses(snapshot.map((entry) => entry.status))
    const auditReady = isAuditReady(counts)

    const pdfItems: AuditPdfItem[] = snapshot.map((entry) => ({
      sort_order: entry.sort_order,
      name: entry.item_type_name,
      cfr_reference: entry.cfr_reference,
      status: entry.status,
      issued_on: entry.issued_on,
      expires_on: entry.expires_on,
      has_document: entry.has_document,
      notes: entry.notes,
    }))

    const driverFullName = `${driver.first_name} ${driver.last_name}`
    const carrierName =
      profile.company_name || profile.full_name || user.email || 'Owner-Operator'

    const pdfBytes = buildAuditPdf({
      carrier_name: carrierName,
      dot_number: profile.dot_number,
      mc_number: profile.mc_number,
      driver_full_name: driverFullName,
      is_owner_operator: driver.is_owner_operator,
      cdl_summary: buildCdlSummary(driver),
      hire_date: driver.hire_date,
      driver_status: driver.status === 'active' ? 'Active' : 'Inactive',
      generated_at_label: formatTimestampForTimezone(generatedAt, profile.timezone),
      audit_ready: auditReady,
      counts,
      items: pdfItems,
    })

    const fileName = buildAuditFileName(driver.first_name, driver.last_name, generatedAt)
    const storagePath = buildAuditPdfStoragePath(user.id, driver.id, fileName)

    const upload = await uploadPdfToStorage(storagePath, pdfBytes)
    if (upload.error) {
      console.error('[rigfile:audit-files.upload]', upload.error)
      return jsonError(
        "We built the PDF but couldn't store it. Give it another try in a moment.",
        'STORAGE_ERROR',
        500
      )
    }

    let auditFile: RigfileAuditFileDetail
    try {
      auditFile = await insertAuditFile(supabase, {
        user_id: user.id,
        driver_id: driver.id,
        driver_name: driverFullName,
        file_name: fileName,
        storage_path: storagePath,
        items_total: counts.total,
        items_valid: counts.valid,
        items_expiring_soon: counts.expiring_soon,
        items_expired: counts.expired,
        items_missing: counts.missing,
        items_snapshot: snapshot,
      })
    } catch (insertError) {
      // Don't leave an orphan PDF behind if the record failed.
      await removeStorageObject(storagePath)
      throw insertError
    }

    const signed = await createSignedDownloadUrl(storagePath, DOWNLOAD_URL_TTL_SECONDS)

    const attentionCount = counts.expired + counts.missing
    const responseBody: AuditFileCreateResponse = {
      audit_file: auditFile,
      download_url: signed.url,
      download_url_expires_in_seconds: DOWNLOAD_URL_TTL_SECONDS,
      audit_ready: auditReady,
      message: auditReady
        ? `${driver.first_name}'s file is audit-ready. Download it, print it, and you're covered.`
        : `PDF generated. Heads up: ${attentionCount} item(s) are expired or missing — an auditor would flag those first.`,
    }
    return jsonData(responseBody, 201)
  } catch (error) {
    return internalErrorResponse('audit-files.create', error)
  }
}
