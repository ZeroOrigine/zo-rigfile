// CANONICAL: Dependency-free PDF generator for RigFile audit-ready DQF summaries.
// Emits a valid PDF 1.4 document using only the built-in Helvetica fonts, so the
// product has zero third-party PDF dependencies. All emitted bytes are ASCII,
// which keeps stream /Length and xref byte offsets exact by construction.
import { daysUntil } from './compliance'
import type { RigfileDqfItemStatus } from './types'

export interface AuditPdfItem {
  sort_order: number
  name: string
  cfr_reference: string
  status: RigfileDqfItemStatus
  issued_on: string | null
  expires_on: string | null
  has_document: boolean
  notes: string | null
}

export interface AuditPdfCounts {
  total: number
  valid: number
  expiring_soon: number
  expired: number
  missing: number
  not_applicable: number
}

export interface AuditPdfInput {
  carrier_name: string
  dot_number: string | null
  mc_number: string | null
  driver_full_name: string
  is_owner_operator: boolean
  cdl_summary: string | null
  hire_date: string | null
  driver_status: string
  generated_at_label: string
  audit_ready: boolean
  counts: AuditPdfCounts
  items: AuditPdfItem[]
}

type RgbColor = readonly [number, number, number]

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN_LEFT = 54
const CONTENT_RIGHT_EDGE = PAGE_WIDTH - 54
const CONTENT_WIDTH = CONTENT_RIGHT_EDGE - MARGIN_LEFT
const FOOTER_RESERVED_HEIGHT = 58

const COLUMNS = {
  index: { x: 54, width: 16 },
  item: { x: 72, width: 168 },
  cfr: { x: 244, width: 88 },
  status: { x: 336, width: 66 },
  issued: { x: 406, width: 48 },
  expires: { x: 458, width: 48 },
  document: { x: 510, width: 48 },
} as const

const BLACK: RgbColor = [0, 0, 0]
const NAVY: RgbColor = [0.09, 0.2, 0.4]
const GRAY: RgbColor = [0.42, 0.45, 0.5]
const GRAY_DARK: RgbColor = [0.25, 0.28, 0.32]
const RULE_LIGHT: RgbColor = [0.85, 0.86, 0.88]
const GREEN: RgbColor = [0.1, 0.47, 0.2]
const RED: RgbColor = [0.75, 0.11, 0.11]

const STATUS_LABELS: Record<RigfileDqfItemStatus, string> = {
  valid: 'Valid',
  expiring_soon: 'Expiring Soon',
  expired: 'EXPIRED',
  missing: 'MISSING',
  not_applicable: 'N/A',
}

const STATUS_COLORS: Record<RigfileDqfItemStatus, RgbColor> = {
  valid: GREEN,
  expiring_soon: [0.72, 0.45, 0.02],
  expired: RED,
  missing: [0.78, 0.3, 0.05],
  not_applicable: [0.45, 0.45, 0.45],
}

function escapePdfText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function wrapText(value: string, maxCharsPerLine: number): string[] {
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let currentLine = ''
  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word
    if (candidate.length <= maxCharsPerLine) {
      currentLine = candidate
      continue
    }
    if (currentLine) {
      lines.push(currentLine)
    }
    if (word.length > maxCharsPerLine) {
      let remaining = word
      while (remaining.length > maxCharsPerLine) {
        lines.push(remaining.slice(0, maxCharsPerLine))
        remaining = remaining.slice(maxCharsPerLine)
      }
      currentLine = remaining
    } else {
      currentLine = word
    }
  }
  if (currentLine) {
    lines.push(currentLine)
  }
  return lines.length > 0 ? lines : ['']
}

function maxCharsForWidth(width: number, fontSize: number): number {
  return Math.max(1, Math.floor(width / (fontSize * 0.52)))
}

function estimateTextWidth(value: string, fontSize: number): number {
  return value.length * fontSize * 0.52
}

/** Assembles page content streams into final PDF bytes with an exact xref table. */
function assemblePdf(pageContents: string[]): Uint8Array {
  const pageCount = pageContents.length
  const firstPageObjectNumber = 5
  const pageObjectNumbers = pageContents.map((_, index) => firstPageObjectNumber + index * 2)
  const contentObjectNumbers = pageContents.map((_, index) => firstPageObjectNumber + index * 2 + 1)
  const totalObjects = 4 + pageCount * 2

  const objects = new Map<number, string>()
  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>')
  objects.set(
    2,
    `<< /Type /Pages /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageCount} >>`
  )
  objects.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  objects.set(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')

  pageContents.forEach((content, index) => {
    objects.set(
      pageObjectNumbers[index],
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumbers[index]} 0 R >>`
    )
    objects.set(contentObjectNumbers[index], `<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  })

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = new Array(totalObjects + 1).fill(0)
  for (let objectNumber = 1; objectNumber <= totalObjects; objectNumber++) {
    offsets[objectNumber] = pdf.length
    pdf += `${objectNumber} 0 obj\n${objects.get(objectNumber)}\nendobj\n`
  }

  const xrefStart = pdf.length
  pdf += `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`
  for (let objectNumber = 1; objectNumber <= totalObjects; objectNumber++) {
    pdf += `${offsets[objectNumber].toString().padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`

  return new TextEncoder().encode(pdf)
}

export function buildAuditPdf(input: AuditPdfInput): Uint8Array {
  const finishedPages: string[][] = []
  let commands: string[] = []
  let cursorY = PAGE_HEIGHT - 54

  const drawText = (
    x: number,
    y: number,
    size: number,
    value: string,
    options: { bold?: boolean; color?: RgbColor } = {}
  ): void => {
    const [red, green, blue] = options.color ?? BLACK
    commands.push(`${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)} rg`)
    commands.push(
      `BT /${options.bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${escapePdfText(value)}) Tj ET`
    )
  }

  const drawRule = (y: number, color: RgbColor = RULE_LIGHT, lineWidth = 0.7): void => {
    const [red, green, blue] = color
    commands.push(`${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)} RG`)
    commands.push(`${lineWidth} w ${MARGIN_LEFT} ${y.toFixed(1)} m ${CONTENT_RIGHT_EDGE} ${y.toFixed(1)} l S`)
  }

  const drawTableHeader = (): void => {
    drawText(COLUMNS.index.x, cursorY, 7.5, '#', { bold: true, color: GRAY_DARK })
    drawText(COLUMNS.item.x, cursorY, 7.5, 'DQF ITEM', { bold: true, color: GRAY_DARK })
    drawText(COLUMNS.cfr.x, cursorY, 7.5, 'REGULATION', { bold: true, color: GRAY_DARK })
    drawText(COLUMNS.status.x, cursorY, 7.5, 'STATUS', { bold: true, color: GRAY_DARK })
    drawText(COLUMNS.issued.x, cursorY, 7.5, 'ISSUED', { bold: true, color: GRAY_DARK })
    drawText(COLUMNS.expires.x, cursorY, 7.5, 'EXPIRES', { bold: true, color: GRAY_DARK })
    drawText(COLUMNS.document.x, cursorY, 7.5, 'DOC', { bold: true, color: GRAY_DARK })
    cursorY -= 5
    drawRule(cursorY, GRAY_DARK, 0.9)
    cursorY -= 12
  }

  const startContinuationPage = (includeTableHeader: boolean): void => {
    finishedPages.push(commands)
    commands = []
    cursorY = PAGE_HEIGHT - 54
    drawText(MARGIN_LEFT, cursorY, 10, `DQF Audit Summary - ${input.driver_full_name} (continued)`, {
      bold: true,
      color: NAVY,
    })
    cursorY -= 8
    drawRule(cursorY)
    cursorY -= 16
    if (includeTableHeader) {
      drawTableHeader()
    }
  }

  // ---- Page 1 header ----
  drawText(MARGIN_LEFT, cursorY, 15, 'Driver Qualification File - Audit Summary', { bold: true, color: NAVY })
  cursorY -= 14
  drawText(MARGIN_LEFT, cursorY, 8.5, `Generated ${input.generated_at_label}  |  RigFile compliance record`, {
    color: GRAY,
  })
  cursorY -= 16
  const carrierParts = [`Carrier: ${input.carrier_name}`]
  if (input.dot_number) {
    carrierParts.push(`USDOT ${input.dot_number}`)
  }
  if (input.mc_number) {
    carrierParts.push(`MC ${input.mc_number}`)
  }
  drawText(MARGIN_LEFT, cursorY, 9.5, carrierParts.join('   |   '), { bold: true })
  cursorY -= 9
  drawRule(cursorY)
  cursorY -= 17
  drawText(
    MARGIN_LEFT,
    cursorY,
    12,
    `Driver: ${input.driver_full_name}${input.is_owner_operator ? '  (Owner-Operator)' : ''}`,
    { bold: true }
  )
  cursorY -= 13
  const driverMetaParts: string[] = []
  if (input.cdl_summary) {
    driverMetaParts.push(input.cdl_summary)
  }
  if (input.hire_date) {
    driverMetaParts.push(`Hired ${input.hire_date}`)
  }
  driverMetaParts.push(`Driver status: ${input.driver_status}`)
  drawText(MARGIN_LEFT, cursorY, 8.5, driverMetaParts.join('   |   '), { color: GRAY })
  cursorY -= 17
  if (input.audit_ready) {
    drawText(MARGIN_LEFT, cursorY, 11.5, 'AUDIT READY - Every applicable DQF item is on file and current.', {
      bold: true,
      color: GREEN,
    })
  } else {
    drawText(
      MARGIN_LEFT,
      cursorY,
      11.5,
      `ACTION NEEDED - ${input.counts.expired} expired, ${input.counts.missing} missing, ${input.counts.expiring_soon} expiring soon.`,
      { bold: true, color: RED }
    )
  }
  cursorY -= 12
  drawText(
    MARGIN_LEFT,
    cursorY,
    8.5,
    `Checklist: ${input.counts.total} items  |  ${input.counts.valid} valid  |  ${input.counts.expiring_soon} expiring soon  |  ${input.counts.expired} expired  |  ${input.counts.missing} missing  |  ${input.counts.not_applicable} not applicable`,
    { color: GRAY_DARK }
  )
  cursorY -= 9
  drawRule(cursorY)
  cursorY -= 16
  drawTableHeader()

  // ---- Item rows ----
  const itemNameMaxChars = maxCharsForWidth(COLUMNS.item.width, 8)
  const cfrMaxChars = maxCharsForWidth(COLUMNS.cfr.width, 8)
  const notesMaxChars = maxCharsForWidth(CONTENT_RIGHT_EDGE - COLUMNS.item.x, 7.5)

  for (const item of input.items) {
    const nameLines = wrapText(item.name, itemNameMaxChars)
    const cfrLines = wrapText(item.cfr_reference, cfrMaxChars)

    let statusDetail: string | null = null
    if (item.expires_on && (item.status === 'expired' || item.status === 'expiring_soon')) {
      const remainingDays = daysUntil(item.expires_on)
      statusDetail =
        item.status === 'expired' ? `${Math.abs(remainingDays)} day(s) ago` : `in ${remainingDays} day(s)`
    }

    let noteLines = item.notes ? wrapText(`Note: ${item.notes}`, notesMaxChars) : []
    if (noteLines.length > 4) {
      noteLines = noteLines.slice(0, 4).concat(['(note truncated)'])
    }

    const statusLineCount = statusDetail ? 2 : 1
    const mainLineCount = Math.max(nameLines.length, cfrLines.length, statusLineCount)
    const rowHeight = mainLineCount * 10 + (noteLines.length > 0 ? noteLines.length * 9 + 3 : 0) + 5

    if (cursorY - rowHeight < 54 + FOOTER_RESERVED_HEIGHT) {
      startContinuationPage(true)
    }

    const rowTop = cursorY
    drawText(COLUMNS.index.x, rowTop, 8, String(item.sort_order), { color: GRAY })
    nameLines.forEach((line, lineIndex) => drawText(COLUMNS.item.x, rowTop - lineIndex * 10, 8, line))
    cfrLines.forEach((line, lineIndex) =>
      drawText(COLUMNS.cfr.x, rowTop - lineIndex * 10, 8, line, { color: GRAY_DARK })
    )
    drawText(COLUMNS.status.x, rowTop, 8, STATUS_LABELS[item.status], {
      bold: item.status === 'expired' || item.status === 'missing',
      color: STATUS_COLORS[item.status],
    })
    if (statusDetail) {
      drawText(COLUMNS.status.x, rowTop - 10, 7, statusDetail, { color: GRAY })
    }
    drawText(COLUMNS.issued.x, rowTop, 8, item.issued_on ?? '-', { color: item.issued_on ? BLACK : GRAY })
    drawText(COLUMNS.expires.x, rowTop, 8, item.expires_on ?? '-', { color: item.expires_on ? BLACK : GRAY })
    drawText(COLUMNS.document.x, rowTop, 8, item.has_document ? 'Yes' : '-', {
      color: item.has_document ? GREEN : GRAY,
    })

    let noteBaselineY = rowTop - mainLineCount * 10 - 2
    for (const line of noteLines) {
      drawText(COLUMNS.item.x, noteBaselineY, 7.5, line, { color: GRAY })
      noteBaselineY -= 9
    }

    cursorY -= rowHeight
    drawRule(cursorY + 4, RULE_LIGHT, 0.4)
  }

  // ---- Certification block ----
  if (cursorY < 54 + FOOTER_RESERVED_HEIGHT + 92) {
    startContinuationPage(false)
  }
  cursorY -= 4
  drawRule(cursorY, GRAY_DARK, 0.9)
  cursorY -= 16
  drawText(MARGIN_LEFT, cursorY, 10, 'Certification', { bold: true })
  cursorY -= 12
  const certificationLines = wrapText(
    'I certify that this summary reflects the driver qualification records tracked in RigFile for the driver named above as of the generation time shown. Source documents remain available for inspection under 49 CFR Part 391.',
    maxCharsForWidth(CONTENT_WIDTH, 8.5)
  )
  for (const line of certificationLines) {
    drawText(MARGIN_LEFT, cursorY, 8.5, line, { color: GRAY_DARK })
    cursorY -= 10
  }
  cursorY -= 14
  drawText(
    MARGIN_LEFT,
    cursorY,
    9,
    'Reviewed by (signature): _________________________________            Date: _______________'
  )

  finishedPages.push(commands)

  // ---- Footers (needs final page count, so applied as a second pass) ----
  const totalPages = finishedPages.length
  finishedPages.forEach((pageCommands, pageIndex) => {
    commands = pageCommands
    drawRule(46, RULE_LIGHT, 0.7)
    drawText(MARGIN_LEFT, 36, 7.5, `RigFile  |  DQF Audit Summary  |  ${input.driver_full_name}`, {
      color: GRAY,
    })
    const pageLabel = `Page ${pageIndex + 1} of ${totalPages}`
    drawText(CONTENT_RIGHT_EDGE - estimateTextWidth(pageLabel, 7.5), 36, 7.5, pageLabel, { color: GRAY })
    drawText(
      MARGIN_LEFT,
      26,
      7,
      'Data as entered by the operator. RigFile is a compliance record-keeping tool, not legal advice.',
      { color: GRAY }
    )
  })

  return assemblePdf(finishedPages.map((pageCommands) => pageCommands.join('\n')))
}

/** Human timestamp in the operator's timezone, falling back to UTC. */
export function formatTimestampForTimezone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(date)
  } catch {
    return `${date.toISOString().replace('T', ' ').slice(0, 16)} UTC`
  }
}

export function buildAuditFileName(firstName: string, lastName: string, generatedAt: Date): string {
  const clean = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '') || 'Driver'
  const stamp = generatedAt.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  return `DQF-Audit_${clean(lastName)}-${clean(firstName)}_${stamp}.pdf`
}
