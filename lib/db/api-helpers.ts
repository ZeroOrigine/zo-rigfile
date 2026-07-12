// CANONICAL: API response envelope, error codes, and pagination for every
// RigFile route. One shape everywhere:
//   success -> { data: <payload>, error: null }
//   failure -> { data: null, error: { message, code, fields? } }
// HTTP status codes carry transport-level status. Requires: zod (declared in
// the product package.json by the scaffold step, per this step's contract).
import { NextResponse } from 'next/server'
import type { ZodError } from 'zod'

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INVALID_JSON'
  | 'PLAN_LIMIT_REACHED'
  | 'UPGRADE_REQUIRED'
  | 'CONFLICT'
  | 'STORAGE_ERROR'
  | 'NOT_CONFIGURED'
  | 'INTERNAL_ERROR'

export interface ApiErrorBody {
  message: string
  code: ApiErrorCode
  fields?: Record<string, string>
}

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export function jsonData<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data, error: null }, { status })
}

export function jsonError(
  message: string,
  code: ApiErrorCode,
  status: number,
  fields?: Record<string, string>
): NextResponse {
  const errorBody: ApiErrorBody = { message, code, ...(fields ? { fields } : {}) }
  return NextResponse.json({ data: null, error: errorBody }, { status })
}

export function unauthorizedResponse(): NextResponse {
  return jsonError('Please sign in to continue.', 'UNAUTHORIZED', 401)
}

/** Logs the internal detail server-side; the client only ever sees a human message. */
export function internalErrorResponse(context: string, error: unknown): NextResponse {
  console.error(`[rigfile:${context}]`, error)
  return jsonError(
    "That didn't work on our end — nothing you did. Give it another try in a few seconds; your data is safe.",
    'INTERNAL_ERROR',
    500
  )
}

export async function parseJsonBody(
  request: Request
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  try {
    const body = await request.json()
    return { ok: true, body }
  } catch {
    return {
      ok: false,
      response: jsonError(
        "We couldn't read that request — the body must be valid JSON.",
        'INVALID_JSON',
        400
      ),
    }
  }
}

/** Turns a ZodError into field-level messages a form can render directly. */
export function zodValidationResponse(error: ZodError): NextResponse {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_root'
    if (!fields[key]) {
      fields[key] = issue.message
    }
  }
  const firstMessage = Object.values(fields)[0] ?? 'Please double-check the highlighted fields.'
  return jsonError(firstMessage, 'VALIDATION_ERROR', 400, fields)
}

export interface PaginationParams {
  page: number
  limit: number
  from: number
  to: number
}

export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const rawLimit = Number.parseInt(searchParams.get('limit') ?? String(DEFAULT_PAGE_SIZE), 10)

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE
  const from = (page - 1) * limit

  return { page, limit, from, to: from + limit - 1 }
}

export function buildPaginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    total_pages: total === 0 ? 0 : Math.ceil(total / limit),
  }
}
