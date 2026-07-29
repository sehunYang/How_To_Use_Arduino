export const SIZE_BUDGETS = {
  initialJsGzipBytes: 250_000,
  indexRawBytes: 400_000,
  indexGzipBytes: 150_000,
} as const

export interface SizeMeasurements {
  initialJsGzipBytes: number
  indexRawBytes: number
  indexGzipBytes: number
}

export interface SizeBudgetViolation {
  budget: keyof SizeMeasurements
  actualBytes: number
  limitBytes: number
  comparison: '<' | '<='
}

export function validateSizeBudgets(
  measurements: SizeMeasurements,
): SizeBudgetViolation[] {
  const violations: SizeBudgetViolation[] = []

  if (measurements.initialJsGzipBytes > SIZE_BUDGETS.initialJsGzipBytes) {
    violations.push({
      budget: 'initialJsGzipBytes',
      actualBytes: measurements.initialJsGzipBytes,
      limitBytes: SIZE_BUDGETS.initialJsGzipBytes,
      comparison: '<=',
    })
  }
  if (measurements.indexRawBytes >= SIZE_BUDGETS.indexRawBytes) {
    violations.push({
      budget: 'indexRawBytes',
      actualBytes: measurements.indexRawBytes,
      limitBytes: SIZE_BUDGETS.indexRawBytes,
      comparison: '<',
    })
  }
  if (measurements.indexGzipBytes > SIZE_BUDGETS.indexGzipBytes) {
    violations.push({
      budget: 'indexGzipBytes',
      actualBytes: measurements.indexGzipBytes,
      limitBytes: SIZE_BUDGETS.indexGzipBytes,
      comparison: '<=',
    })
  }

  return violations
}
