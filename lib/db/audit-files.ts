// CANONICAL: Audit file data service. The rigfile_audit_files table is an
// immutable-in-spirit log — this service exposes list, read, and insert only.
// No update or delete functions exist on purpose.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuditSnapshotItem, RigfileAuditFile, RigfileAuditFileDetail } from './types'

export const AUDIT_FILE_LIST_COLUMNS =
  'id, driver_id, driver_name, file_name, storage_path, items_total, items_valid, items_expiring_soon, items_expired, items_missing, created_at'

export const AUDIT_FILE_DETAIL_COLUMNS = `${AUDIT_FILE_LIST_COLUMNS}, items_snapshot, updated_at`

export async function listAuditFiles(
  supabase: SupabaseClient,
  userId: string,
  options: { driverId?: string; from: number; to: number }
): Promise<{ auditFiles: RigfileAuditFile[]; total: number }> {
  let query = supabase
    .from('rigfile_audit_files')
    .select(AUDIT_FILE_LIST_COLUMNS, { count: 'exact' })
    .eq('user_id', userId)

  if (options.driverId) {
    query = query.eq('driver_id', options.driverId)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(options.from, options.to)

  if (error) {
    throw new Error(`Failed to list audit files: ${error.message}`)
  }
  return { auditFiles: (data ?? []) as RigfileAuditFile[], total: count ?? 0 }
}

export async function getAuditFileById(
  supabase: SupabaseClient,
  userId: string,
  auditFileId: string
): Promise<RigfileAuditFileDetail | null> {
  const { data, error } = await supabase
    .from('rigfile_audit_files')
    .select(AUDIT_FILE_DETAIL_COLUMNS)
    .eq('user_id', userId)
    .eq('id', auditFileId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load audit file: ${error.message}`)
  }
  return (data as unknown as RigfileAuditFileDetail | null) ?? null
}

export interface NewAuditFileRecord {
  user_id: string
  driver_id: string
  driver_name: string
  file_name: string
  storage_path: string
  items_total: number
  items_valid: number
  items_expiring_soon: number
  items_expired: number
  items_missing: number
  items_snapshot: AuditSnapshotItem[]
}

export async function insertAuditFile(
  supabase: SupabaseClient,
  record: NewAuditFileRecord
): Promise<RigfileAuditFileDetail> {
  const { data, error } = await supabase
    .from('rigfile_audit_files')
    .insert(record)
    .select(AUDIT_FILE_DETAIL_COLUMNS)
    .single()

  if (error || !data) {
    throw new Error(`Failed to record audit file: ${error ? error.message : 'no row returned'}`)
  }
  return data as unknown as RigfileAuditFileDetail
}
