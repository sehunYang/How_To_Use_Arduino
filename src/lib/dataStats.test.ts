import { describe, expect, it } from 'vitest'
import {
  collectNumericColumns,
  formatMeasurement,
  pairColumns,
  parseMeasurement,
  summarizeColumn,
  summarizeRelation,
} from './dataStats'

describe('parseMeasurement', () => {
  it.each([
    ['21.5', 21.5],
    ['-3', -3],
    ['.5', 0.5],
    ['1e3', 1000],
    ["'42", 42],
  ])('reads %s as a measurement', (field, expected) => {
    expect(parseMeasurement(field)).toBe(expected)
  })

  it.each(['', '21.5 C', 'ERROR', '1,000', 'NaN', '--3'])('rejects %s', (field) => {
    expect(parseMeasurement(field)).toBeNull()
  })
})

describe('collectNumericColumns', () => {
  it('keeps columns whose values are mostly numbers and reports gaps as null', () => {
    const columns = collectNumericColumns(
      ['time_ms', 'temperature_c', 'state'],
      [
        ['0', '21.5', 'OK'],
        ['1000', 'ERROR', 'OK'],
        ['2000', '21.9', 'OK'],
      ],
    )

    expect(columns.map((column) => column.name)).toEqual(['time_ms', 'temperature_c'])
    expect(columns[1].values).toEqual([21.5, null, 21.9])
    expect(columns[1].numericCount).toBe(2)
    expect(columns[0].index).toBe(0)
  })

  it('drops a column when fewer than half of its values are numbers', () => {
    const columns = collectNumericColumns(
      ['value'],
      [['1'], ['waiting'], ['waiting'], ['waiting']],
    )

    expect(columns).toEqual([])
  })
})

describe('summarizeColumn', () => {
  it('computes the sample spread and quartiles by linear interpolation', () => {
    const summary = summarizeColumn([2, 4, 4, 4, 5, 5, 7, 9])

    expect(summary).not.toBeNull()
    expect(summary?.count).toBe(8)
    expect(summary?.mean).toBe(5)
    expect(summary?.standardDeviation).toBeCloseTo(2.13809, 5)
    expect(summary?.min).toBe(2)
    expect(summary?.quartile1).toBe(4)
    expect(summary?.median).toBe(4.5)
    expect(summary?.quartile3).toBe(5.5)
    expect(summary?.max).toBe(9)
    expect(summary?.range).toBe(7)
  })

  it('leaves the spread undefined for a single measurement', () => {
    expect(summarizeColumn([3])?.standardDeviation).toBeNull()
  })

  it('returns nothing when there is no measurement', () => {
    expect(summarizeColumn([])).toBeNull()
  })
})

describe('summarizeRelation', () => {
  const timeColumn = { index: 0, name: 'time', values: [0, 1, 2, 3], numericCount: 4 }

  it('fits a line through points that lie exactly on it', () => {
    const relation = summarizeRelation([
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
    ])

    expect(relation?.slope).toBeCloseTo(2, 10)
    expect(relation?.intercept).toBeCloseTo(1, 10)
    expect(relation?.correlation).toBeCloseTo(1, 10)
    expect(relation?.determination).toBeCloseTo(1, 10)
    expect(relation?.count).toBe(4)
  })

  it('reports a negative correlation when one value falls as the other rises', () => {
    const relation = summarizeRelation([
      { x: 0, y: 10 },
      { x: 1, y: 8 },
      { x: 2, y: 6 },
    ])

    expect(relation?.slope).toBeCloseTo(-2, 10)
    expect(relation?.correlation).toBeCloseTo(-1, 10)
  })

  it('gives up when every x is the same, because no line can be fitted', () => {
    expect(summarizeRelation([{ x: 1, y: 2 }, { x: 1, y: 5 }])).toBeNull()
  })

  it('leaves the correlation undefined when y never changes', () => {
    const relation = summarizeRelation([{ x: 1, y: 2 }, { x: 2, y: 2 }])

    expect(relation?.slope).toBe(0)
    expect(relation?.correlation).toBeNull()
    expect(relation?.determination).toBeNull()
  })

  it('needs at least two points', () => {
    expect(summarizeRelation([{ x: 1, y: 2 }])).toBeNull()
  })

  it('pairs columns by row and skips rows missing either value', () => {
    const sensorColumn = { index: 1, name: 'lux', values: [10, null, 30, 40], numericCount: 3 }

    expect(pairColumns(timeColumn, sensorColumn)).toEqual([
      { x: 0, y: 10 },
      { x: 2, y: 30 },
      { x: 3, y: 40 },
    ])
  })
})

describe('formatMeasurement', () => {
  it.each([
    [21.5, '21.5'],
    [0, '0'],
    [1234.5678, '1,234.57'],
    [-0.25, '-0.25'],
  ])('writes %d as %s', (value, expected) => {
    expect(formatMeasurement(value)).toBe(expected)
  })

  it('uses powers of ten for very small and very large values', () => {
    expect(formatMeasurement(0.00012345)).toBe('1.2345×10⁻⁴')
    expect(formatMeasurement(25_000_000)).toBe('2.5×10⁷')
  })

  it('drops the thousands separator where a number sits next to x', () => {
    expect(formatMeasurement(1234.5678, { grouping: false })).toBe('1234.57')
  })

  it('marks values that cannot be shown', () => {
    expect(formatMeasurement(Number.NaN)).toBe('—')
  })
})
