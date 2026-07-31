import { describe, expect, it } from 'vitest'
import { convertSerialTextToCsv, createSerialCsvFilename } from './serialCsv'

describe('convertSerialTextToCsv', () => {
  it('converts a header and rows while normalizing whitespace and Windows line endings', () => {
    const result = convertSerialTextToCsv('time_ms,temperature_c,humidity_pct\r\n  0,21.5,48.2\r\n  1000,21.7,48.0\r\n')

    expect(result).toMatchObject({ ok: true, columnCount: 3, dataRowCount: 2, excludedRows: [] })
    if (result.ok) expect(result.csv).toBe('time_ms,temperature_c,humidity_pct\r\n0,21.5,48.2\r\n1000,21.7,48.0')
  })

  it('skips diagnostics and reports malformed row numbers without silently losing them', () => {
    const result = convertSerialTextToCsv('WOKWI_READY\ntime_ms,value\n0,1\nSENSOR_ERROR: retry\n1000\ntemp=2,value=3\n2000,3')

    expect(result).toMatchObject({
      ok: true,
      dataRowCount: 2,
      excludedRows: [
        { lineNumber: 1, reason: '상태 또는 진단 메시지' },
        { lineNumber: 4, reason: '상태 또는 진단 메시지' },
        { lineNumber: 5, reason: '열 개수 불일치 (1개, 예상 2개)' },
        { lineNumber: 6, reason: '상태 또는 진단 메시지' },
      ],
    })
  })

  it('excludes a repeated header after the board restarts', () => {
    const result = convertSerialTextToCsv('time_ms,value\n0,1\ntime_ms,value\n0,2')

    expect(result).toMatchObject({
      ok: true,
      dataRowCount: 2,
      excludedRows: [{ lineNumber: 3, reason: '반복된 CSV 헤더' }],
    })
  })

  it('parses and re-escapes quoted commas and quotes', () => {
    const result = convertSerialTextToCsv('time_ms,note\n0,"warm, stable"\n1,"sensor said ""ready"""')

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.csv).toContain('0,"warm, stable"\r\n1,"sensor said ""ready"""')
  })

  it('preserves a quoted field containing a line break', () => {
    const result = convertSerialTextToCsv('time_ms,note\n0,"first line\nsecond line"')

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.csv).toContain('0,"first line\nsecond line"')
  })

  it('supports Korean headers', () => {
    const result = convertSerialTextToCsv('시간,온도\n0,21.5')
    expect(result).toMatchObject({ ok: true, header: ['시간', '온도'] })
  })

  it('prevents spreadsheet formulas while preserving signed numbers', () => {
    const result = convertSerialTextToCsv('time_ms,value,note\n0,-21.5,=1+1\n1,+3,@SUM(A1:A2)')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.csv).toContain("0,-21.5,'=1+1")
      expect(result.csv).toContain("1,+3,'@SUM(A1:A2)")
    }
  })

  it('rejects input without a header', () => {
    const result = convertSerialTextToCsv('0,21.5\n1000,21.7')
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(result.error).toContain('헤더')
  })

  it('rejects a header with no valid data rows', () => {
    const result = convertSerialTextToCsv('time_ms,value\ninvalid')
    expect(result).toMatchObject({ ok: false, excludedRows: [{ lineNumber: 2 }] })
    if (!result.ok) expect(result.error).toContain('데이터 행')
  })

  it('converts 10,000 data rows', () => {
    const rows = Array.from({ length: 10_000 }, (_, index) => `${index},${index / 10}`)
    const result = convertSerialTextToCsv(['time_ms,value', ...rows].join('\n'))
    expect(result).toMatchObject({ ok: true, dataRowCount: 10_000 })
  })
})

describe('createSerialCsvFilename', () => {
  it('uses a sortable local timestamp', () => {
    expect(createSerialCsvFilename(new Date(2026, 6, 31, 9, 5, 7))).toBe('arduino-data-20260731-090507.csv')
  })
})
