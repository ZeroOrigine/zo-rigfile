// CANONICAL: /api/dqf-items/[id]/document — attach proof documents to a DQF item.
//   POST   -> issue a signed upload URL (client uploads directly to Storage)
//   PUT    -> confirm the upload and attach it to the item
//   DELETE -> detach and remove the stored document
// All storage paths are namespaced under the owner's user id and verified
// server-side, so one operator can never point at another operator's file.
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
import { DEFAULT_REMINDER_LEAD_DAYS, daysUntil, effectiveDqfStatus } from '@/lib/db/compliance'
import {
  ALLOWED_DOCUMENT_EXTENSIONS_LABEL,
  buildDocumentStoragePath,
  createSignedUploadTarget,
  isAllowedDocumentFileName,
  removeStorageObject,
  sanitizeFileName,
  storageObjectExists,
} from '@/lib/supabase/storage'
import type { RigfileDqfItemWithType } from '@/lib/db/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

// Mirrors the Storage bucket's 15MB object cap so clients get fast, friendly
// feedback instead of an opaque 413 from the bucket after uploading bytes.
const MAX_DOCUMENT_FILE_SIZE_BYTES = 15728640

const requestUploadSchema = z
  .object({
    file_name: z
      .string({ required_error: 'file_name is required.', invalid_type_error: 'file_name must be text.' })
      .trim()
      .min(1, 'file_name is required.')
      .max(200, 'Keep the file name under 200 characters.'),
    file_size: z
      .number({ invalid_type_error: 'file_size must be a number of bytes.' })
      .int('file_size must be a whole number of bytes.')
      .positive('file_size must be greater than zero.')
      .max(
        MAX_DOCUMENT_FILE_SIZE_BYTES,
        'That file is over the 15MB limit. Compress it or scan at a lower resolution, then try again.'
      )
      .optional(),
  })
  .strict("That request includes fields we don't recognize.")

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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
    const parsed = requestUploadSchema.safeParse(parsedBody.body)
    if (!parsed.success) {
      return zodValidationResponse(parsed.error)
    }

    if (parsed.data.file_size !== undefined && parsed.data.file_size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
      return jsonError(
        'That file is over the 15MB limit. Compress it or scan at a lower resolution, then try again.',
        'VALIDATION_ERROR',
        400,
        { file_size: 'Keep the file under 15MB (15,728,640 bytes).' }
      )
    }

    if (!isAllowedDocumentFileName(parsed.data.file_name)) {
      return jsonError(
        `We can attach ${ALLOWED_DOCUMENT_EXTENSIONS_LABEL} files. That file looks like a different type.`,
        'VALIDATION_ERROR',
        400,
        { file_name: `Use a ${ALLOWED_DOCUMENT_EXTENSIONS_LABEL} file.` }
      )
    }

    const item = await getItemByIdWithType(supabase, user.id, parsedId.data)
    if (!item) {
      return itemNotFoundResponse()
    }

    const storagePath = buildDocumentStoragePath(user.id, item.driver_id, item.id, parsed.data.file_name)
    const { target, error } = await createSignedUploadTarget(storagePath)
    if (error || !target) {
      console.error('[rigfile:documents.upload-url]', error)
      return jsonError(
        "We couldn't prepare the upload. Give it another try in a moment.",
        'STORAGE_ERROR',
        500
      )
    }

    return jsonData({
      storage_path: target.storage_path,
      upload_url: target.upload_url,
      token: target.token,
      expires_in_seconds: 7200,
      max_file_size_bytes: MAX_DOCUMENT_FILE_SIZE_BYTES,
      next_step:
        'Upload the file bytes to upload_url (or use supabase-js uploadToSignedUrl with the token), then PUT this same endpoint with { storage_path, file_name } to attach it. Files over 15MB (15,728,640 bytes) are rejected — send file_size here first to pre-check.',
    })
  } catch (error) {
    return internalErrorResponse('documents.request-upload', error)
  }
}

const attachDocumentSchema = z
  .object({
    storage_path: z
      .string({ required_error: 'storage_path is required.', invalid_type_error: 'storage_path must be text.' })
      .min(1, 'storage_path is required.')
      .max(500, 'That storage path looks too long.'),
    file_name: z
      .string({ required_error: 'file_name is required.', invalid_type_error: 'file_name must be text.' })
      .trim()
      .min(1, 'file_name is required.')
      .max(200, 'Keep the file name under 200 characters.'),
  })
  .strict("That request includes fields we don't recognize.")

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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
    const parsed = attachDocumentSchema.safeParse(parsedBody.body)
    if (!parsed.success) {
      return zodValidationResponse(parsed.error)
    }

    const item = await getItemByIdWithType(supabase, user.id, parsedId.data)
    if (!item) {
      return itemNotFoundResponse()
    }

    // Ownership check: the path must sit inside THIS user's folder for THIS item.
    const requiredPrefix = `${user.id}/documents/${item.driver_id}/${item.id}/`
    if (!parsed.data.storage_path.startsWith(requiredPrefix)) {
      return jsonError("That upload doesn't belong to this item.", 'FORBIDDEN', 403)
    }

    const exists = await storageObjectExists(parsed.data.storage_path)
    if (!exists) {
      return jsonError(
        "We couldn't find that upload. It may have expired — request a new upload link and try again.",
        'VALIDATION_ERROR',
        400,
        { storage_path: 'Upload the file first, then attach it.' }
      )
    }

    const previousDocumentPath = item.document_path

    const updatedItem = await updateDqfItem(supabase, user.id, item.id, {
      document_path: parsed.data.storage_path,
      document_name: sanitizeFileName(parsed.data.file_name),
      document_uploaded_at: new Date().toISOString(),
    })
    if (!updatedItem) {
      return itemNotFoundResponse()
    }

    // Replaced an older document? Clean up the orphan (best-effort).
    if (previousDocumentPath && previousDocumentPath !== parsed.data.storage_path) {
      await removeStorageObject(previousDocumentPath)
    }

    const profile = await getProfile(supabase, user.id)
    const warnDays = profile?.reminder_lead_days ?? DEFAULT_REMINDER_LEAD_DAYS

    return jsonData({
      dqf_item: toItemView(updatedItem, warnDays),
      message: `Document attached to ${updatedItem.item_type.name}. One more item locked down.`,
    })
  } catch (error) {
    return internalErrorResponse('documents.attach', error)
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
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

    const item = await getItemByIdWithType(supabase, user.id, parsedId.data)
    if (!item) {
      return itemNotFoundResponse()
    }
    if (!item.document_path) {
      return jsonError("There's no document attached to this item.", 'NOT_FOUND', 404)
    }

    const documentPath = item.document_path
    const updatedItem = await updateDqfItem(supabase, user.id, item.id, {
      document_path: null,
      document_name: null,
      document_uploaded_at: null,
    })
    if (!updatedItem) {
      return itemNotFoundResponse()
    }

    await removeStorageObject(documentPath)

    const profile = await getProfile(supabase, user.id)
    const warnDays = profile?.reminder_lead_days ?? DEFAULT_REMINDER_LEAD_DAYS

    return jsonData({ dqf_item: toItemView(updatedItem, warnDays), message: 'Document removed.' })
  } catch (error) {
    return internalErrorResponse('documents.detach', error)
  }
}
