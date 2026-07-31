import { createTimestampedFilename, downloadBlob } from '@/lib/downloadFile'

export const MAX_SERIAL_INPUT_CHARS = 5_000_000

export interface ExcludedSerialRow {
  lineNumber: number
  content: string
  reason: string
}

export interface SerialCsvSuccess {
  ok: true
  csv: string
  header: string[]
  /** 헤더를 뺀 측정값 행. 그래프와 통계가 CSV 문자열을 다시 읽지 않도록 그대로 전달합니다. */
  rows: string[][]
  columnCount: number
  dataRowCount: number
  excludedRows: ExcludedSerialRow[]
}

export interface SerialCsvFailure {
  ok: false
  error: string
  excludedRows: ExcludedSerialRow[]
}

export type SerialCsvResult = SerialCsvSuccess | SerialCsvFailure

interface ParsedLine {
  fields: string[] | null
  error?: string
}

interface SerialRecord {
  content: string
  lineNumber: number
}

function splitSerialRecords(input: string): SerialRecord[] {
  const records: SerialRecord[] = []
  let content = ''
  let quoted = false
  let lineNumber = 1
  let recordLineNumber = 1

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        content += '""'
        index += 1
        continue
      }
      quoted = !quoted
      content += character
      continue
    }
    if (character === '\n' && !quoted) {
      records.push({ content, lineNumber: recordLineNumber })
      content = ''
      lineNumber += 1
      recordLineNumber = lineNumber
      continue
    }
    if (character === '\n') lineNumber += 1
    content += character
  }
  records.push({ content, lineNumber: recordLineNumber })
  return records
}

function parseCsvLine(line: string): ParsedLine {
  const fields: string[] = []
  let field = ''
  let quoted = false
  let quoteClosed = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]

    if (quoted) {
      if (character === '"') {
        if (line[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
          quoteClosed = true
        }
      } else {
        field += character
      }
      continue
    }

    if (character === '"') {
      if (field.trim().length > 0 || quoteClosed) {
        return { fields: null, error: '큰따옴표 형식이 올바르지 않음' }
      }
      quoted = true
      continue
    }

    if (character === ',') {
      fields.push(field.trim())
      field = ''
      quoteClosed = false
      continue
    }

    if (quoteClosed && !/\s/.test(character)) {
      return { fields: null, error: '닫는 큰따옴표 뒤에 문자가 있음' }
    }
    field += character
  }

  if (quoted) return { fields: null, error: '닫히지 않은 큰따옴표가 있음' }
  fields.push(field.trim())
  return { fields }
}

function escapeCsvField(field: string) {
  const spreadsheetSafeField = /^[=@]/.test(field) || (/^[+-]/.test(field) && !Number.isFinite(Number(field)))
    ? `'${field}`
    : field
  return /[",\r\n]/.test(spreadsheetSafeField)
    ? `"${spreadsheetSafeField.replaceAll('"', '""')}"`
    : spreadsheetSafeField
}

function csvLine(fields: readonly string[]) {
  return fields.map(escapeCsvField).join(',')
}

/**
 * 헤더와 값 행을 CSV 한 덩어리로 묶습니다. 회차를 여러 번 붙여넣었을 때
 * 회차 열을 앞에 붙인 표를 다시 만들 수 있도록 밖으로 내보냅니다.
 */
export function buildCsv(header: readonly string[], rows: readonly (readonly string[])[]) {
  return [csvLine(header), ...rows.map(csvLine)].join('\r\n')
}

function looksLikeDiagnostic(line: string) {
  const normalized = line.trim()
  return normalized.startsWith('#')
    || normalized.startsWith('//')
    || /^(WOKWI_READY|SENSOR_ERROR)(?:\b|:)/i.test(normalized)
    || /^(?:[^,=]+=[^,]*)(?:,\s*[^,=]+=[^,]*)*$/.test(normalized)
}

function looksLikeHeader(fields: string[]) {
  if (fields.length < 2 || fields.some((field) => field.length === 0)) return false
  return fields.some((field) => !Number.isFinite(Number(field)))
}

function excluded(lineNumber: number, content: string, reason: string): ExcludedSerialRow {
  return { lineNumber, content, reason }
}

export function convertSerialTextToCsv(input: string): SerialCsvResult {
  if (input.length > MAX_SERIAL_INPUT_CHARS) {
    return {
      ok: false,
      error: `입력 내용이 너무 큽니다. ${MAX_SERIAL_INPUT_CHARS.toLocaleString('ko-KR')}자 이하로 붙여넣어 주세요.`,
      excludedRows: [],
    }
  }

  const normalizedInput = input.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n').replaceAll('\r', '\n')
  const records = splitSerialRecords(normalizedInput)
  const excludedRows: ExcludedSerialRow[] = []
  let header: string[] | null = null
  const dataRows: string[][] = []

  for (const record of records) {
    const { lineNumber, content } = record
    const trimmed = content.trim()

    if (!trimmed) continue

    if (!header) {
      if (looksLikeDiagnostic(trimmed)) {
        excludedRows.push(excluded(lineNumber, content, '상태 또는 진단 메시지'))
        continue
      }

      const parsed = parseCsvLine(trimmed)
      if (!parsed.fields) {
        excludedRows.push(excluded(lineNumber, content, parsed.error ?? 'CSV 형식 오류'))
        continue
      }
      if (!looksLikeHeader(parsed.fields)) {
        return {
          ok: false,
          error: `${lineNumber}번째 줄에서 CSV 헤더를 찾을 수 없습니다. 첫 데이터 행 앞에 쉼표로 구분한 열 이름을 넣어 주세요.`,
          excludedRows,
        }
      }
      header = parsed.fields
      continue
    }

    if (looksLikeDiagnostic(trimmed)) {
      excludedRows.push(excluded(lineNumber, content, '상태 또는 진단 메시지'))
      continue
    }

    const parsed = parseCsvLine(trimmed)
    if (!parsed.fields) {
      excludedRows.push(excluded(lineNumber, content, parsed.error ?? 'CSV 형식 오류'))
    } else if (parsed.fields.length === header.length && parsed.fields.every((field, index) => field === header![index])) {
      excludedRows.push(excluded(lineNumber, content, '반복된 CSV 헤더'))
    } else if (parsed.fields.length !== header.length) {
      excludedRows.push(excluded(
        lineNumber,
        content,
        `열 개수 불일치 (${parsed.fields.length}개, 예상 ${header.length}개)`,
      ))
    } else {
      dataRows.push(parsed.fields)
    }
  }

  if (!header) {
    return {
      ok: false,
      error: 'CSV 헤더를 찾을 수 없습니다. 첫 줄에 쉼표로 구분한 열 이름을 넣어 주세요.',
      excludedRows,
    }
  }

  if (dataRows.length === 0) {
    return {
      ok: false,
      error: '저장할 수 있는 데이터 행이 없습니다. 헤더 다음 줄부터 측정값을 붙여넣어 주세요.',
      excludedRows,
    }
  }

  return {
    ok: true,
    csv: buildCsv(header, dataRows),
    header,
    rows: dataRows,
    columnCount: header.length,
    dataRowCount: dataRows.length,
    excludedRows,
  }
}

export function createSerialCsvFilename(date = new Date()) {
  return createTimestampedFilename('arduino-data', 'csv', date)
}

export function downloadSerialCsv(csv: string, filename = createSerialCsvFilename()) {
  // \uC55E\uBA38\uB9AC BOM\uC740 \uC5D1\uC140\uC774 \uD30C\uC77C\uC744 UTF-8\uB85C \uC77D\uAC8C \uD574 \uD55C\uAE00 \uC5F4 \uC774\uB984\uC774 \uAE68\uC9C0\uC9C0 \uC54A\uAC8C \uD569\uB2C8\uB2E4.
  downloadBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), filename)
}
