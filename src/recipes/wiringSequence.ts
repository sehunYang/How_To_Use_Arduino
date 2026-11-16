import type { Recipe } from '@/schema'
import { isBoardMountedEndpoint, planBreadboardWiring } from '@/wokwi/buildDiagram'

/**
 * 학생이 실제로 손을 한 번 움직이는 단위, 곧 **선 하나**를 한 단계로 삼은 배선 순서.
 *
 * 레시피의 `wiring`은 "INA219 VCC를 5V에"처럼 무엇과 무엇이 이어져야 하는지를 적습니다.
 * 브레드보드를 거치면 그 한 줄이 아두이노→브레드보드, 브레드보드→센서처럼 선 두세 개가
 * 되는데, 예전 화면은 그 선들을 한 단계에 몰아 한꺼번에 깜빡였습니다. 학생은 어느 선부터
 * 꽂을지 몰라 헤맸습니다. 여기서는 `planBreadboardWiring`이 정한 실제 선을 하나씩 단계로
 * 펼칩니다. 배선도와 시뮬레이션이 같은 계획을 쓰므로 그림과 단계가 어긋나지 않습니다.
 */
export interface WireStep {
  from: string
  to: string
  color: string
  /** 이 선이 속한 레시피 배선 줄의 번호(0부터). */
  recipeStep: number
  /** 그 줄을 이루는 선 가운데 몇 번째인지(1부터)와 모두 몇 개인지. */
  part: number
  parts: number
  /** 레시피 배선 줄의 설명. 이 선이 무엇을 위한 것인지 알려 줍니다. */
  purpose: string
  /**
   * - wire: 점퍼선 한 가닥
   * - leg: 저항·LED 같은 부품의 다리를 브레드보드에 바로 꽂음(선이 없음)
   */
  kind: 'wire' | 'leg'
}

export function wiringSequence(recipe: Recipe): WireStep[] {
  const planned = planBreadboardWiring(recipe)
  const partsByStep = new Map<number, number>()
  for (const connection of planned) {
    partsByStep.set(connection.stepIndex, (partsByStep.get(connection.stepIndex) ?? 0) + 1)
  }
  const seen = new Map<number, number>()
  return planned.map((connection) => {
    const part = (seen.get(connection.stepIndex) ?? 0) + 1
    seen.set(connection.stepIndex, part)
    const isHole = (endpoint: string) => endpoint.startsWith('BB.')
    const leg = (isBoardMountedEndpoint(connection.from) && isHole(connection.to))
      || (isBoardMountedEndpoint(connection.to) && isHole(connection.from))
    return {
      from: connection.from,
      to: connection.to,
      color: connection.color,
      recipeStep: connection.stepIndex,
      part,
      parts: partsByStep.get(connection.stepIndex) ?? 1,
      purpose: recipe.wiring[connection.stepIndex]?.text ?? '',
      kind: leg ? 'leg' : 'wire',
    }
  })
}

const RAILS: Record<string, string> = {
  tp: '위쪽 빨강(+) 줄',
  tn: '위쪽 파랑(−) 줄',
  bp: '아래쪽 빨강(+) 줄',
  bn: '아래쪽 파랑(−) 줄',
}

/**
 * `BB.tp.5`, `BB.12t.a` 같은 브레드보드 구멍 이름을 학생이 찾아갈 수 있는 말로 옮깁니다.
 * 브레드보드 구멍이 아니면 `null`입니다.
 */
export function breadboardHoleLabel(endpoint: string): string | null {
  const rail = /^BB\.(tp|tn|bp|bn)\.(\d+)$/.exec(endpoint)
  if (rail) return `브레드보드 ${RAILS[rail[1]]} ${rail[2]}번 구멍`
  const strip = /^BB\.(\d+)([tb])\.([a-j])$/.exec(endpoint)
  if (strip) return `브레드보드 ${strip[2] === 't' ? '위쪽' : '아래쪽'} ${strip[1]}번 묶음 ${strip[3]}칸`
  return null
}
