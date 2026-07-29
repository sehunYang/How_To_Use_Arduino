import { describe, expect, it } from 'vitest'
import {
  SIZE_BUDGETS,
  validateSizeBudgets,
  type SizeMeasurements,
} from './sizeBudgets'

const withinBudget: SizeMeasurements = {
  initialJsGzipBytes: SIZE_BUDGETS.initialJsGzipBytes,
  indexRawBytes: SIZE_BUDGETS.indexRawBytes - 1,
  indexGzipBytes: SIZE_BUDGETS.indexGzipBytes,
}

describe('validateSizeBudgets', () => {
  it('accepts measurements at every inclusive boundary', () => {
    expect(validateSizeBudgets(withinBudget)).toEqual([])
  })

  it('rejects initial JavaScript above 250000 gzip bytes', () => {
    expect(
      validateSizeBudgets({
        ...withinBudget,
        initialJsGzipBytes: SIZE_BUDGETS.initialJsGzipBytes + 1,
      }),
    ).toEqual([
      expect.objectContaining({ budget: 'initialJsGzipBytes' }),
    ])
  })

  it('rejects an index at the exclusive 400000 raw-byte boundary', () => {
    expect(
      validateSizeBudgets({
        ...withinBudget,
        indexRawBytes: SIZE_BUDGETS.indexRawBytes,
      }),
    ).toEqual([expect.objectContaining({ budget: 'indexRawBytes' })])
  })

  it('rejects an index above 150000 gzip bytes', () => {
    expect(
      validateSizeBudgets({
        ...withinBudget,
        indexGzipBytes: SIZE_BUDGETS.indexGzipBytes + 1,
      }),
    ).toEqual([expect.objectContaining({ budget: 'indexGzipBytes' })])
  })
})
