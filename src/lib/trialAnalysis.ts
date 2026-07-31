/**
 * 반복 실험(회차) 분석. 레시피 대부분이 "길이별로 3회 반복" 같은 반복 측정을 요구하므로,
 * 시리얼 데이터를 회차별로 모아 두고 회차 사이의 흩어진 정도까지 계산합니다.
 *
 * 회차를 겹치는 기준은 가로축 값이 아니라 **측정 순번**입니다. 아두이노가 `millis()`로
 * 찍는 시각은 회차마다 0, 500, 1000이 아니라 0, 501, 1002처럼 조금씩 밀리기 때문에,
 * 가로축 값이 정확히 같은 것만 묶으면 거의 모든 점이 혼자 남습니다. 같은 순번의 측정끼리
 * 묶으면 회차가 같은 절차를 따랐을 때 언제나 맞아떨어집니다. 다만 회차마다 가로축 값이
 * 크게 다르면 그 평균은 뜻을 잃으므로, 얼마나 벌어졌는지를 함께 돌려주어 화면이 경고합니다.
 */
import { summarizeColumn, type MeasurementPoint } from '@/lib/dataStats'

export interface Trial {
  id: number
  /** `1회차`처럼 화면과 CSV에 그대로 쓰는 이름 */
  label: string
  header: string[]
  rows: string[][]
}

export function trialLabel(order: number) {
  return `${order}회차`
}

/**
 * 새로 붙여넣은 데이터의 열 이름이 1회차와 다르면 그 차이를 설명하는 문장을 돌려줍니다.
 * 열 순서만 다른 것은 이름으로 값을 찾으므로 문제가 되지 않습니다.
 */
export function describeHeaderMismatch(expected: readonly string[], actual: readonly string[]): string | null {
  const missing = expected.filter((name) => !actual.includes(name))
  const added = actual.filter((name) => !expected.includes(name))
  if (missing.length === 0 && added.length === 0) return null

  const differences: string[] = []
  if (missing.length > 0) differences.push(`빠진 열: ${missing.join(', ')}`)
  if (added.length > 0) differences.push(`처음 보는 열: ${added.join(', ')}`)
  return `1회차와 열 이름이 달라 같은 실험으로 묶을 수 없습니다. ${differences.join(' · ')}`
}

/**
 * 한 측정 순번에 모인 회차별 값의 요약. `y`는 평균이고, 나머지는 상자그림을 그리는 다섯 수치입니다.
 * 회차 수가 적을 때는 사분위수가 최솟값·최댓값에 가까워져 상자가 곧 값의 범위가 됩니다.
 */
export interface AggregatedPoint extends MeasurementPoint {
  /** 이 순번에서 모인 회차 수 */
  count: number
  min: number
  quartile1: number
  median: number
  quartile3: number
  max: number
  /** 회차 사이에 값이 흩어진 정도(표본 표준편차). 한 회차뿐이면 정할 수 없어 null입니다. */
  standardDeviation: number | null
  /** 이 순번에서 회차별 가로축 값이 벌어진 폭 */
  xSpread: number
}

export interface TrialAggregate {
  points: AggregatedPoint[]
  /** 두 회차 이상에서 측정된 순번의 개수. 오차 막대를 그릴 수 있는 점의 수입니다. */
  repeatedCount: number
  /**
   * 회차별 가로축 값이 가장 크게 벌어진 폭을 전체 가로축 범위로 나눈 비율.
   * 이 값이 크면 회차마다 다른 조건을 측정한 것이므로 평균을 믿을 수 없습니다.
   */
  worstSpreadRatio: number
}

/** 회차별 점 목록을 같은 순번끼리 묶어 평균과 흩어진 정도를 구합니다. */
export function aggregateByOrder(trialPoints: readonly (readonly MeasurementPoint[])[]): TrialAggregate {
  const longest = trialPoints.reduce((length, points) => Math.max(length, points.length), 0)
  const points: AggregatedPoint[] = []

  for (let order = 0; order < longest; order += 1) {
    const group = trialPoints.map((entry) => entry[order]).filter((point): point is MeasurementPoint => Boolean(point))
    if (group.length === 0) continue

    const summary = summarizeColumn(group.map((point) => point.y))
    if (!summary) continue

    const xValues = group.map((point) => point.x)

    points.push({
      x: xValues.reduce((total, value) => total + value, 0) / group.length,
      y: summary.mean,
      count: group.length,
      min: summary.min,
      quartile1: summary.quartile1,
      median: summary.median,
      quartile3: summary.quartile3,
      max: summary.max,
      standardDeviation: summary.standardDeviation,
      xSpread: Math.max(...xValues) - Math.min(...xValues),
    })
  }

  const xRange = points.length > 0
    ? Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x))
    : 0
  const worstSpread = points.reduce((widest, point) => Math.max(widest, point.xSpread), 0)

  return {
    points,
    repeatedCount: points.filter((point) => point.count >= 2).length,
    worstSpreadRatio: xRange > 0 ? worstSpread / xRange : 0,
  }
}

/**
 * 회차마다 가로축 값이 이 비율보다 크게 벌어지면 같은 조건을 반복한 것으로 보기 어렵습니다.
 * 전체 가로축 범위의 5%를 기준으로 삼았습니다.
 */
export const MAX_TRUSTWORTHY_SPREAD_RATIO = 0.05
