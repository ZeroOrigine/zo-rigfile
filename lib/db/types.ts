// CANONICAL: Domain types for RigFile — mirrors the rigfile_* Postgres schema.
// Every service and route imports these types; nothing redefines them.

export type RigfileDriverStatus = 'active' | 'inactive'

export type RigfileDqfItemStatus =
  | 'valid'
  | 'expiring_soon'
  | 'expired'
  | 'missing'
  | 'not_applicable'

export type RigfilePlan = 'free' | 'solo' | 'fleet'

export type RigfileSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused'

export interface RigfileProfile {
  id: string
  email: string | null
  full_name: string
  company_name: string | null
  dot_number: string | null
  mc_number: string | null
  phone: string | null
  timezone: string
  reminder_lead_days: number
  role: 'user' | 'admin'
  created_at: string
  updated_at: string
}

export interface RigfileDriver {
  id: string
  first_name: string
  last_name: string
  is_owner_operator: boolean
  date_of_birth: string | null
  hire_date: string | null
  cdl_number: string | null
  cdl_state: string | null
  cdl_class: 'A' | 'B' | 'C' | null
  status: RigfileDriverStatus
  created_at: string
  updated_at: string
}

export interface RigfileDqfItemType {
  id: string
  code: string
  name: string
  description: string
  cfr_reference: string
  default_validity_months: number | null
  can_expire: boolean
  is_conditional: boolean
  sort_order: number
}

export interface RigfileDqfItem {
  id: string
  driver_id: string
  item_type_id: string
  status: RigfileDqfItemStatus
  issued_on: string | null
  expires_on: string | null
  document_path: string | null
  document_name: string | null
  document_uploaded_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RigfileDqfItemWithType extends RigfileDqfItem {
  item_type: RigfileDqfItemType
}

export interface AuditSnapshotItem {
  item_type_code: string
  item_type_name: string
  cfr_reference: string
  sort_order: number
  status: RigfileDqfItemStatus
  issued_on: string | null
  expires_on: string | null
  has_document: boolean
  document_name: string | null
  notes: string | null
}

export interface RigfileAuditFile {
  id: string
  driver_id: string
  driver_name: string
  file_name: string
  storage_path: string | null
  items_total: number
  items_valid: number
  items_expiring_soon: number
  items_expired: number
  items_missing: number
  created_at: string
}

export interface RigfileAuditFileDetail extends RigfileAuditFile {
  items_snapshot: AuditSnapshotItem[]
  updated_at: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  total_pages: number
}
