import { describe, expect, it } from 'vitest'
import { EMPTY_RANGE, cropRows, hasRange } from '@/lib/rowRange'

const HEADER = ['time_ms', 'distance_m']
const ROWS = [
  ['0', '1.20'],
  ['100', '1.20'],
  ['200', '1.15'],
  ['300', '0.95'],
  ['400', '0.60'],
]

describe('cropRows', () => {
  it('keeps only the rows inside the range', () => {
    const cropped = cropRows(HEADER, ROWS, { column: 'time_ms', min: '200', max: '300' })
    expect(cropped).toEqual([['200', '1.15'], ['300', '0.95']])
  })

  it('treats an empty end as "to the end"', () => {
    expect(cropRows(HEADER, ROWS, { column: 'time_ms', min: '300', max: '' })).toHaveLength(2)
    expect(cropRows(HEADER, ROWS, { column: 'time_ms', min: '', max: '100' })).toHaveLength(2)
  })

  /** 구간 안인지 밖인지 판단할 수 없는 행을 남기면 그래프에 정체 모를 점이 남습니다. */
  it('drops a row whose reference value cannot be read as a number', () => {
    const rows = [...ROWS, ['nan', '0.40']]
    expect(cropRows(HEADER, rows, { column: 'time_ms', min: '0', max: '' })).toHaveLength(5)
  })

  it('leaves the rows alone when nothing is set or the column is gone', () => {
    expect(cropRows(HEADER, ROWS, EMPTY_RANGE)).toEqual(ROWS)
    expect(cropRows(HEADER, ROWS, { column: 'time_ms', min: '', max: '' })).toEqual(ROWS)
    expect(cropRows(HEADER, ROWS, { column: '없는열', min: '1', max: '2' })).toEqual(ROWS)
    expect(cropRows(HEADER, ROWS, { column: 'time_ms', min: '앞', max: '' })).toEqual(ROWS)
  })

  it('copies the rows so the original stays untouched', () => {
    const cropped = cropRows(HEADER, ROWS, EMPTY_RANGE)
    cropped[0][0] = '999'
    expect(ROWS[0][0]).toBe('0')
  })
})

describe('hasRange', () => {
  it('is set only when a column and at least one end are given', () => {
    expect(hasRange(EMPTY_RANGE)).toBe(false)
    expect(hasRange({ column: 'time_ms', min: '', max: '' })).toBe(false)
    expect(hasRange({ column: '', min: '1', max: '2' })).toBe(false)
    expect(hasRange({ column: 'time_ms', min: '1', max: '' })).toBe(true)
  })
})
