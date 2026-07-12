// CANONICAL: /api/audit-files/[id] — read one generated audit file with its full
// point-in-time snapshot and a fresh signed download URL. The audit log is
// immutable-in-spirit: there is intentionally no PATCH or DELETE here.
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedContext } from '@/lib/supabase/server'
import {
  internalErrorResponse,
  jsonData,
  jsonError,
  unauthorizedResponse,
  zodValidationResponse,
} from '@/lib/db/api-helpers'
import { getAuditFileById } from '@/lib/db/audit-files'
import { createSignedDownloadUrl } from '@/lib/supabase/storage'
import type { RigfileAuditFileDetail } from '@/lib/db/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DOWNLOAD_URL_TTL_SECONDS = 600

interface AuditFileDetailResponse {
  audit_file: RigfileAuditFileDetail
  download_url: string | null
  download_url_expires_in_seconds: number | null
}

const auditFileIdSchema = z.string().uuid({ message: 'That audit file link looks malformed.' })

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getAuthenticatedContext()
    if (!context) {
      return unauthorizedResponse()
    }
    const { supabase, user } = context

    const parsedId = auditFileIdSchema.safeParse(params.id)
    if (!parsedId.success) {
      return zodValidationResponse(parsedId.error)
    }

    // The RLS-scoped read doubles as the ownership proof before we sign a URL
    // with the service role.
    const auditFile = await getAuditFileById(supabase, user.id, parsedId.data)
    if (!auditFile) {
      return jsonError("We couldn't find that audit file.", 'NOT_FOUND', 404)
    }

    let downloadUrl: string | null = null
    if (auditFile.storage_path) {
      const signed = await createSignedDownloadUrl(auditFile.storage_path, DOWNLOAD_URL_TTL_SECONDS)
      downloadUrl = signed.url
    }

    const responseBody: AuditFileDetailResponse = {
      audit_file: auditFile,
      download_url: downloadUrl,
      download_url_expires_in_seconds: downloadUrl ? DOWNLOAD_URL_TTL_SECONDS : null,
    }
    return jsonData(responseBody)
  } catch (error) {
    return internalErrorResponse('audit-files.get', error)
  }
}
