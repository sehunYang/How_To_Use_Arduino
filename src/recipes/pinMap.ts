import type { Recipe } from '@/schema'
import { parseManifest } from '@/validation/manifest'

/**
 * 배선 한 줄과 코드 한 줄을 잇는 자리.
 *
 * 스케치는 `// @pin LED=D9`처럼 어느 이름이 어느 보드 핀인지를 이미 적어 두고
 * 있고, 빌드는 그 선언을 배선과 교차검증까지 합니다(`staticCheck`). 그런데
 * 화면에 그리기 직전에 그 줄을 지웠기 때문에(`parseDisplayCode`), 배선의
 * `HC-SR04.TRIG → UNO.D9`와 코드의 `const byte TRIG = 9;`가 같은 것을 가리킨다는
 * 사실을 학생만 알 수 없었습니다. 핀을 다른 자리로 옮기고 싶은 학생은 배선과
 * 코드 가운데 어느 쪽을, 몇 군데를 고쳐야 하는지 짐작하지 못한 채 멈춥니다.
 * 시스템이 이미 아는 대응을 그대로 보여 줍니다.
 */
export interface PinLine {
  /** 이 핀을 꽂는 배선 단계 번호(1부터). 배선에 나오지 않으면 `null`. */
  step: number | null
  /** 보드 쪽 핀 이름. `D9`, `A4` 같은 것. */
  pin: string
  /**
   * 코드가 이 핀을 부르는 이름. 보드 핀 이름과 같으면 `null`입니다.
   * (`// @pin A4=A4`처럼 이름 없이 자리만 선언한 경우)
   */
  role: string | null
  /** 이 핀에 이어지는 반대쪽 끝. 배선 단계에 적힌 그대로입니다. */
  endpoint: string | null
}

/** `UNO.D9` → `D9`. 보드 쪽 끝이 아니면 `null`. */
function boardPin(endpoint: string): string | null {
  const match = /^UNO\.(.+)$/.exec(endpoint)
  return match ? match[1] : null
}

/**
 * 스케치가 선언한 핀을 배선 단계와 짝지어 돌려줍니다.
 *
 * 배선에 나오는 차례대로 냅니다. 학생이 위에서부터 꽂은 순서와 표의 순서가
 * 같아야 눈으로 따라갈 수 있기 때문입니다. 배선에 없는 선언은 뒤에 붙입니다.
 */
export function pinMapFor(recipe: Pick<Recipe, 'sketch' | 'wiring'>): PinLine[] {
  const declared = parseManifest(recipe.sketch).pins
  const roleByPin = new Map<string, string>()
  for (const [role, pin] of Object.entries(declared)) {
    // 같은 핀을 두 이름으로 선언하는 스케치는 없습니다. 있어도 먼저 적힌 것을 씁니다.
    if (!roleByPin.has(pin)) roleByPin.set(pin, role)
  }

  const lines: PinLine[] = []
  const seen = new Set<string>()
  recipe.wiring.forEach((step, index) => {
    for (const [end, other] of [[step.from, step.to], [step.to, step.from]] as const) {
      const pin = boardPin(end)
      // 전원과 접지는 코드가 부르지 않습니다. 표에 넣으면 고칠 수 없는 줄만 늘어납니다.
      if (!pin || !roleByPin.has(pin) || seen.has(pin)) continue
      seen.add(pin)
      const role = roleByPin.get(pin)!
      lines.push({ step: index + 1, pin, role: role === pin ? null : role, endpoint: other })
    }
  })

  for (const [pin, role] of roleByPin) {
    if (seen.has(pin)) continue
    lines.push({ step: null, pin, role: role === pin ? null : role, endpoint: null })
  }

  return lines
}
