import { describe, expect, it } from 'vitest'
import { aggregateByOrder, describeHeaderMismatch, trialLabel } from './trialAnalysis'

describe('describeHeaderMismatch', () => {
  it('accepts the same columns in a different order', () => {
    expect(describeHeaderMismatch(['time_ms', 'temp'], ['temp', 'time_ms'])).toBeNull()
  })

  it('names the columns that went missing and the ones that appeared', () => {
    const message = describeHeaderMismatch(['time_ms', 'temp'], ['time_ms', 'lux'])

    expect(message).toContain('빠진 열: temp')
    expect(message).toContain('처음 보는 열: lux')
  })
})

describe('trialLabel', () => {
  it('numbers trials the way the recipes phrase repeats', () => {
    expect(trialLabel(3)).toBe('3회차')
  })
})

describe('aggregateByOrder', () => {
  it('averages the same measurement position across trials and measures the spread', () => {
    const aggregate = aggregateByOrder([
      [{ x: 0, y: 10 }, { x: 500, y: 20 }],
      [{ x: 0, y: 12 }, { x: 500, y: 24 }],
      [{ x: 0, y: 14 }, { x: 500, y: 22 }],
    ])

    expect(aggregate.points).toHaveLength(2)
    expect(aggregate.points[0].y).toBe(12)
    expect(aggregate.points[0].count).toBe(3)
    expect(aggregate.points[0].standardDeviation).toBe(2)
    // 10 · 12 · 14를 상자그림으로 그리면 중앙값 12, 상자는 11부터 13, 수염은 10과 14입니다.
    expect(aggregate.points[0].min).toBe(10)
    expect(aggregate.points[0].quartile1).toBe(11)
    expect(aggregate.points[0].median).toBe(12)
    expect(aggregate.points[0].quartile3).toBe(13)
    expect(aggregate.points[0].max).toBe(14)
    expect(aggregate.points[1].y).toBe(22)
    expect(aggregate.repeatedCount).toBe(2)
  })

  it('pairs by position rather than by x, because millis() drifts between runs', () => {
    const aggregate = aggregateByOrder([
      [{ x: 0, y: 10 }, { x: 500, y: 20 }],
      [{ x: 1, y: 12 }, { x: 502, y: 22 }],
    ])

    expect(aggregate.points).toHaveLength(2)
    expect(aggregate.points[0].x).toBe(0.5)
    expect(aggregate.points[0].y).toBe(11)
    expect(aggregate.points[1].xSpread).toBe(2)
    // 두 회차의 시각이 2ms 벌어졌을 뿐이라 전체 범위에 견주면 무시할 수준입니다.
    expect(aggregate.worstSpreadRatio).toBeLessThan(0.05)
  })

  it('flags trials that measured different conditions at the same position', () => {
    const aggregate = aggregateByOrder([
      [{ x: 0, y: 10 }, { x: 100, y: 20 }],
      [{ x: 60, y: 12 }, { x: 160, y: 22 }],
    ])

    expect(aggregate.worstSpreadRatio).toBeGreaterThan(0.05)
  })

  it('keeps positions measured by a single trial but leaves them without an error bar', () => {
    const aggregate = aggregateByOrder([
      [{ x: 0, y: 10 }, { x: 500, y: 20 }],
      [{ x: 0, y: 12 }],
    ])

    expect(aggregate.points).toHaveLength(2)
    expect(aggregate.points[1].count).toBe(1)
    expect(aggregate.points[1].standardDeviation).toBeNull()
    expect(aggregate.points[1].min).toBe(aggregate.points[1].max)
    expect(aggregate.repeatedCount).toBe(1)
  })

  it('returns nothing to plot when no trial has any point', () => {
    expect(aggregateByOrder([[], []])).toEqual({ points: [], repeatedCount: 0, worstSpreadRatio: 0 })
  })
})
