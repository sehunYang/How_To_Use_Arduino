/**
 * 붙여넣은 시리얼 데이터에서 측정값 열을 찾아 요약 통계와 두 변인의 관계를 계산합니다.
 *
 * 계산을 화면에서 떼어 놓아 그래프·요약표·설명 문장이 모두 같은 수치를 쓰도록 했습니다.
 * 모든 함수는 값이 모자라면 예외를 던지지 않고 null을 돌려주며, 화면이 그 자리에
 * 무엇이 부족한지 설명합니다.
 */

/** 부호·소수점·지수 표기까지 허용하되, 단위나 문자가 섞이면 값으로 보지 않습니다. */
const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
}

/** 측정값 한 칸을 숫자로 읽습니다. 숫자로 볼 수 없으면 null입니다. */
export function parseMeasurement(field: string): number | null {
  // 표 계산 프로그램이 수식으로 읽지 않도록 CSV 저장 때 붙인 작은따옴표는 값이 아닙니다.
  const normalized = field.trim().replace(/^'/, '')
  if (!NUMBER_PATTERN.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

export interface NumericColumn {
  /** 원래 CSV에서의 열 번호. 화면의 선택 상태를 이 번호로 기억합니다. */
  index: number
  name: string
  /** 행 순서를 그대로 유지한 값. 숫자로 읽을 수 없는 칸은 null입니다. */
  values: (number | null)[]
  numericCount: number
}

/**
 * 값의 절반 이상을 숫자로 읽을 수 있는 열만 측정값 열로 봅니다.
 * 상태 문자열이 대부분인 열을 축으로 고르면 점이 거의 그려지지 않기 때문입니다.
 */
export function collectNumericColumns(header: readonly string[], rows: readonly string[][]): NumericColumn[] {
  return header
    .map((name, index) => {
      const values = rows.map((row) => parseMeasurement(row[index] ?? ''))
      const numericCount = values.reduce<number>((total, value) => (value === null ? total : total + 1), 0)
      return { index, name, values, numericCount }
    })
    .filter((column) => column.numericCount > 0 && column.numericCount * 2 >= rows.length)
}

export interface ColumnSummary {
  count: number
  mean: number
  /** 표본 표준편차(n−1). 값이 하나뿐이면 퍼진 정도를 정할 수 없어 null입니다. */
  standardDeviation: number | null
  min: number
  quartile1: number
  median: number
  quartile3: number
  max: number
  range: number
}

/**
 * 정렬된 값에서 백분위수를 선형 보간으로 구합니다.
 * 표 계산 프로그램(PERCENTILE.INC)과 같은 방식이라 학생이 스프레드시트로
 * 다시 계산해도 같은 값이 나옵니다.
 */
function quantile(sorted: readonly number[], fraction: number): number {
  const position = (sorted.length - 1) * fraction
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

export function summarizeColumn(values: readonly number[]): ColumnSummary | null {
  if (values.length === 0) return null

  const sorted = [...values].sort((a, b) => a - b)
  const count = sorted.length
  const mean = sorted.reduce((total, value) => total + value, 0) / count
  const squaredDeviation = sorted.reduce((total, value) => total + (value - mean) ** 2, 0)

  return {
    count,
    mean,
    standardDeviation: count < 2 ? null : Math.sqrt(squaredDeviation / (count - 1)),
    min: sorted[0],
    quartile1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    quartile3: quantile(sorted, 0.75),
    max: sorted[count - 1],
    range: sorted[count - 1] - sorted[0],
  }
}

export interface MeasurementPoint {
  x: number
  y: number
}

/** 두 값 목록을 같은 순번끼리 짝지어 점으로 만듭니다. 한쪽이라도 비어 있으면 건너뜁니다. */
export function pairValues(
  xValues: readonly (number | null)[],
  yValues: readonly (number | null)[],
): MeasurementPoint[] {
  const points: MeasurementPoint[] = []
  const length = Math.min(xValues.length, yValues.length)

  for (let index = 0; index < length; index += 1) {
    const x = xValues[index]
    const y = yValues[index]
    if (x === null || y === null) continue
    points.push({ x, y })
  }

  return points
}

/** 두 열을 같은 행끼리 짝지어 점으로 만듭니다. */
export function pairColumns(xColumn: NumericColumn, yColumn: NumericColumn): MeasurementPoint[] {
  return pairValues(xColumn.values, yColumn.values)
}

/**
 * 이름으로 찾은 열의 값을 행 순서대로 읽습니다.
 * 회차마다 열 순서가 달라도 같은 측정값을 짝지을 수 있어야 하므로 번호가 아닌 이름으로 찾습니다.
 */
export function readNamedColumn(
  header: readonly string[],
  rows: readonly string[][],
  name: string,
): (number | null)[] {
  const index = header.indexOf(name)
  if (index < 0) return rows.map(() => null)
  return rows.map((row) => parseMeasurement(row[index] ?? ''))
}

export interface RelationSummary {
  count: number
  /** 회귀직선 y = 기울기·x + 절편 */
  slope: number
  intercept: number
  /** 상관계수 r. y가 모두 같은 값이면 정할 수 없어 null입니다. */
  correlation: number | null
  /** 직선이 측정값을 얼마나 잘 설명하는지 나타내는 값(R²) */
  determination: number | null
}

/** 최소제곱법으로 회귀직선과 상관계수를 구합니다. */
export function summarizeRelation(points: readonly MeasurementPoint[]): RelationSummary | null {
  if (points.length < 2) return null

  const count = points.length
  const meanX = points.reduce((total, point) => total + point.x, 0) / count
  const meanY = points.reduce((total, point) => total + point.y, 0) / count

  let productSum = 0
  let squaredX = 0
  let squaredY = 0
  for (const point of points) {
    const deviationX = point.x - meanX
    const deviationY = point.y - meanY
    productSum += deviationX * deviationY
    squaredX += deviationX ** 2
    squaredY += deviationY ** 2
  }

  // x가 모두 같은 값이면 세로선이 되어 기울기를 정할 수 없습니다.
  if (squaredX === 0) return null

  const slope = productSum / squaredX
  const correlation = squaredY === 0 ? null : productSum / Math.sqrt(squaredX * squaredY)

  return {
    count,
    slope,
    intercept: meanY - slope * meanX,
    correlation,
    determination: correlation === null ? null : correlation ** 2,
  }
}

function toSuperscript(value: string) {
  return [...value].map((character) => SUPERSCRIPT_DIGITS[character] ?? character).join('')
}

export interface MeasurementFormat {
  /**
   * 남길 유효숫자 자리 수. 기본 6자리는 아두이노가 흔히 출력하는 소수 두 자리 값
   * (예: 1013.25 hPa)을 자르지 않으면서 평균·표준편차가 지나치게 길어지지 않는 선입니다.
   */
  significantDigits?: number
  /** 천 단위 구분 쉼표를 넣을지. 회귀식처럼 x와 붙는 자리에서는 끕니다. */
  grouping?: boolean
}

/**
 * 측정값을 학생이 읽기 좋은 문자열로 만듭니다.
 * 아주 크거나 아주 작은 값은 `1.23×10⁻⁴`처럼 10의 거듭제곱으로 적습니다.
 */
export function formatMeasurement(value: number, format: MeasurementFormat = {}): string {
  const { significantDigits = 6, grouping = true } = format
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '0'

  const magnitude = Math.abs(value)
  if (magnitude >= 1e6 || magnitude < 1e-3) {
    const [mantissa, exponent] = value.toExponential(significantDigits - 1).split('e')
    const trimmedMantissa = Number(mantissa).toString()
    return `${trimmedMantissa}×10${toSuperscript(String(Number(exponent)))}`
  }

  const rounded = Number(value.toPrecision(significantDigits))
  return rounded.toLocaleString('ko-KR', { maximumFractionDigits: 12, useGrouping: grouping })
}
