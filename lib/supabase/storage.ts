// CANONICAL: Supabase Storage helpers for RigFile.
// One private bucket holds everything: uploaded DQF documents and generated
// audit PDFs, always namespaced under the owning user's id.
//
// Optional env var: RIGFILE_STORAGE_BUCKET (defaults to 'rigfile-documents',
// matching the schema comment on rigfile_dqf_items.document_path).
import { createSupabaseAdminClient } from './server'

export const RIGFILE_STORAGE_BUCKET = process.env.RIGFILE_STORAGE_BUCKET ?? 'rigfile-documents'

const ALLOWED_DOCUMENT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic'] as const

export const ALLOWED_DOCUMENT_EXTENSIONS_LABEL = 'PDF, JPG, PNG, WEBP, or HEIC'

export function getFileExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
    return ''
  }
  return fileName.slice(lastDotIndex + 1).toLowerCase()
}

export function isAllowedDocumentFileName(fileName: string): boolean {
  const extension = getFileExtension(fileName)
  return (ALLOWED_DOCUMENT_EXTENSIONS as readonly string[]).includes(extension)
}

export function sanitizeFileName(fileName: string): string {
  const withoutSlashes = fileName.trim().replace(/[/\\]/g, '-')
  const cleaned = withoutSlashes.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_')
  return cleaned.slice(0, 120) || 'document'
}

export function buildDocumentStoragePath(
  userId: string,
  driverId: string,
  itemId: string,
  fileName: string
): string {
  return `${userId}/documents/${driverId}/${itemId}/${Date.now()}-${sanitizeFileName(fileName)}`
}

export function buildAuditPdfStoragePath(userId: string, driverId: string, fileName: string): string {
  return `${userId}/audit-files/${driverId}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`
}

export function isPathOwnedByUser(storagePath: string, userId: string): boolean {
  return storagePath.startsWith(`${userId}/`)
}

let bucketVerified = false

/** Verifies the bucket exists; creates it (private) on first miss so a fresh
 * deployment self-heals instead of failing the user's first upload. */
export async function ensureStorageBucketExists(): Promise<void> {
  if (bucketVerified) {
    return
  }
  const admin = createSupabaseAdminClient()
  const { data } = await admin.storage.getBucket(RIGFILE_STORAGE_BUCKET)
  if (!data) {
    // Ignore "already exists" races — another request may have just created it.
    await admin.storage.createBucket(RIGFILE_STORAGE_BUCKET, { public: false })
  }
  bucketVerified = true
}

export async function uploadPdfToStorage(
  storagePath: string,
  pdfBytes: Uint8Array
): Promise<{ error: string | null }> {
  await ensureStorageBucketExists()
  const admin = createSupabaseAdminClient()
  const { error } = await admin.storage
    .from(RIGFILE_STORAGE_BUCKET)
    .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: false })
  return { error: error ? error.message : null }
}

export async function createSignedDownloadUrl(
  storagePath: string,
  expiresInSeconds = 600
): Promise<{ url: string | null; error: string | null }> {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.storage
    .from(RIGFILE_STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds, { download: true })
  if (error || !data?.signedUrl) {
    return { url: null, error: error ? error.message : 'No signed URL returned.' }
  }
  return { url: data.signedUrl, error: null }
}

export interface SignedUploadTarget {
  storage_path: string
  upload_url: string
  token: string
}

export async function createSignedUploadTarget(
  storagePath: string
): Promise<{ target: SignedUploadTarget | null; error: string | null }> {
  await ensureStorageBucketExists()
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.storage
    .from(RIGFILE_STORAGE_BUCKET)
    .createSignedUploadUrl(storagePath)
  if (error || !data) {
    return { target: null, error: error ? error.message : 'No upload URL returned.' }
  }
  return {
    target: { storage_path: storagePath, upload_url: data.signedUrl, token: data.token },
    error: null,
  }
}

export async function storageObjectExists(storagePath: string): Promise<boolean> {
  const admin = createSupabaseAdminClient()
  const lastSlashIndex = storagePath.lastIndexOf('/')
  if (lastSlashIndex === -1) {
    return false
  }
  const folder = storagePath.slice(0, lastSlashIndex)
  const objectName = storagePath.slice(lastSlashIndex + 1)
  const { data, error } = await admin.storage
    .from(RIGFILE_STORAGE_BUCKET)
    .list(folder, { limit: 100, search: objectName })
  if (error || !data) {
    return false
  }
  return data.some((entry) => entry.name === objectName)
}

/** Best-effort delete — a leaked orphan object is better than a failed request. */
export async function removeStorageObject(storagePath: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    await admin.storage.from(RIGFILE_STORAGE_BUCKET).remove([storagePath])
  } catch (error) {
    console.error('[rigfile:storage.remove] failed to remove object', storagePath, error)
  }
}
