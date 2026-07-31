import { describe, expect, it } from 'vitest'
import { createAxisScale, estimateTextWidth, extent } from './chartScale'

describe('createAxisScale', () => {
  it('rounds the range out to readable tick values', () => {
    const scale = createAxisScale(0.4, 9.7)

    expect(scale.min).toBe(0)
    expect(scale.max).toBe(10)
    expect(scale.ticks).toEqual([0, 2, 4, 6, 8, 10])
  })

  it('keeps ticks free of floating point noise', () => {
    const scale = createAxisScale(0, 1)

    expect(scale.ticks).toEqual([0, 0.2, 0.4, 0.6000000000000001, 0.8, 1].map((value) => Number(value.toPrecision(12))))
    expect(scale.ticks).toContain(0.6)
  })

  it('opens up a range when every measurement is the same', () => {
    const scale = createAxisScale(21.5, 21.5)

    expect(scale.min).toBeLessThan(21.5)
    expect(scale.max).toBeGreaterThan(21.5)
    expect(scale.ticks.length).toBeGreaterThan(1)
  })

  it('still produces a usable axis when every measurement is zero', () => {
    const scale = createAxisScale(0, 0)

    expect(scale.min).toBeLessThan(scale.max)
    expect(scale.ticks).toContain(0)
  })

  it('handles negative measurements', () => {
    const scale = createAxisScale(-8, -1)

    expect(scale.min).toBeLessThanOrEqual(-8)
    expect(scale.max).toBeGreaterThanOrEqual(-1)
  })

  it('falls back to a unit axis when there is nothing to plot', () => {
    expect(createAxisScale(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY)).toEqual({
      min: 0,
      max: 1,
      ticks: [0, 0.5, 1],
    })
  })
})

describe('extent', () => {
  it('finds the smallest and largest value without spreading the array', () => {
    expect(extent([3, -2, 7, 0])).toEqual({ min: -2, max: 7 })
  })

  it('survives a measurement set large enough to break argument spreading', () => {
    const values = Array.from({ length: 200_000 }, (_, index) => index)

    expect(extent(values)).toEqual({ min: 0, max: 199_999 })
  })
})

describe('estimateTextWidth', () => {
  it('gives Hangul more room than Latin letters', () => {
    expect(estimateTextWidth('온도', 13)).toBeGreaterThan(estimateTextWidth('ab', 13))
  })
})
