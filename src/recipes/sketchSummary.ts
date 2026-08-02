import type { Recipe } from '@/schema'
import { findCsvHeader } from '@/data/inquiry/columns'

/**
 * 코드가 무슨 일을 하는지 세 줄로.
 *
 * 코딩을 처음 하는 학생에게 스케치는 **복사할 덩어리**일 뿐입니다. 화면은
 * 바꿔 볼 값만 노란 줄로 알려 주는데, 그 값이 무엇을 바꾸는지는 전체 흐름을
 * 알아야 짐작할 수 있습니다. 흐름이라고 해 봐야 "켜질 때 한 번 준비하고, 그
 * 뒤로는 같은 일을 되풀이하며 값을 찍는다"가 전부이므로 그것만 적습니다.
 *
 * 요약은 스케치에서 읽어 만듭니다. 손으로 적으면 간격이나 열 이름을 고칠 때
 * 설명만 옛날 값으로 남습니다.
 */

/** `void loop()`부터 끝까지. 준비 단계의 `delay()`를 측정 간격으로 잘못 읽지 않으려고 나눕니다. */
function loopBody(sketch: string): string {
  const start = sketch.search(/void\s+loop\s*\(/)
  return start === -1 ? '' : sketch.slice(start)
}

/** 되풀이 한 바퀴에 쉬는 시간(ms). 여러 번 쉰다면 모두 더합니다. */
export function loopIntervalMs(sketch: string): number | null {
  const body = loopBody(sketch)
  if (!body) return null

  let total = 0
  let found = false
  for (const match of body.matchAll(/\bdelay\s*\(\s*(\d+)\s*\)/g)) {
    total += Number(match[1])
    found = true
  }
  for (const match of body.matchAll(/\bdelayMicroseconds\s*\(\s*(\d+)\s*\)/g)) {
    total += Number(match[1]) / 1000
    found = true
  }
  return found ? total : null
}

function describeInterval(ms: number): string {
  if (ms >= 1000) {
    const seconds = ms / 1000
    return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}초에 한 번씩`
  }
  if (ms >= 1) return `${Math.round(ms)}밀리초에 한 번씩`
  return '쉴 틈 없이 빠르게'
}

export function sketchSummary(recipe: Pick<Recipe, 'sketch' | 'baudRate' | 'tunables'>): string[] {
  const lines = [
    `**켜질 때 한 번** — \`setup()\` 안의 줄들이 실행됩니다. 시리얼 통신을 ${recipe.baudRate} baud로 열고 센서를 쓸 수 있게 준비합니다.`,
  ]

  const interval = loopIntervalMs(recipe.sketch)
  lines.push(
    `**그 뒤로 계속 되풀이** — \`loop()\` 안의 줄들이 전원을 뽑을 때까지 반복됩니다.${
      interval === null ? '' : ` 한 바퀴에 ${describeInterval(interval)} 값을 읽습니다.`
    }`,
  )

  const header = findCsvHeader(recipe.sketch)
  if (header) {
    lines.push(
      `**읽은 값은 한 줄씩 찍습니다** — 쉼표로 이어 \`${header}\` 차례로 나옵니다. 이 모양 그대로 데이터 화면에 붙여 넣으면 됩니다.`,
    )
  }

  if (recipe.tunables.length > 0) {
    lines.push(
      `**노란 줄 ${recipe.tunables.length}곳만 바꾸세요** — 탐구하면서 바꿔 볼 값이라 표시해 둔 자리입니다. 나머지 줄은 그대로 두는 편이 안전합니다.`,
    )
  }

  return lines
}
