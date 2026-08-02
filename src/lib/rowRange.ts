/**
 * 분석할 구간만 남깁니다.
 *
 * 레시피의 여러 탐구는 기록 전체가 아니라 **한 토막**을 봅니다. 자유낙하는 떨어지는
 * 동안만, 뉴턴 제2법칙은 가속하는 동안만, 줄열은 가열 구간만이 분석 대상입니다.
 * 구간을 고를 수 없으면 낙하 전 정지 구간까지 직선에 함께 끼어 기울기가 절반으로
 * 줄어듭니다. 그래서 자르기를 계산보다 **먼저** 둡니다. 구간을 정한 뒤 시간을 0부터
 * 다시 세거나(`time_ms - first(time_ms)`) 누적합을 구하면 그 구간만의 값이 됩니다.
 */
import { parseMeasurement } from '@/lib/dataStats'

export interface RowRange {
  /** 기준으로 삼을 열 이름. 보통 시각 열입니다. */
  column: string
  /** 비워 두면 그쪽 끝은 자르지 않습니다. */
  min: string
  max: string
}

export const EMPTY_RANGE: RowRange = { column: '', min: '', max: '' }

export function hasRange(range: RowRange) {
  return Boolean(range.column) && (range.min.trim() !== '' || range.max.trim() !== '')
}

/**
 * 기준 열의 값이 구간 안에 드는 행만 남깁니다. 기준 열을 숫자로 읽을 수 없는 행은
 * 구간 안인지 밖인지 판단할 수 없으므로 함께 빼냅니다.
 */
export function cropRows(
  header: readonly string[],
  rows: readonly string[][],
  range: RowRange,
): string[][] {
  if (!hasRange(range)) return rows.map((row) => [...row])

  const index = header.indexOf(range.column)
  if (index < 0) return rows.map((row) => [...row])

  const min = range.min.trim() === '' ? null : Number(range.min)
  const max = range.max.trim() === '' ? null : Number(range.max)
  if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max))) {
    return rows.map((row) => [...row])
  }

  return rows
    .filter((row) => {
      const value = parseMeasurement(row[index] ?? '')
      if (value === null) return false
      if (min !== null && value < min) return false
      if (max !== null && value > max) return false
      return true
    })
    .map((row) => [...row])
}
