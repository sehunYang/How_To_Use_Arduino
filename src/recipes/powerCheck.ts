import type { Recipe } from '@/schema'
import { baseToken, partLabel, splitEndpoint } from './parts'

/**
 * 전원을 넣기 **직전**에 한 번 더 짚어 볼 것들.
 *
 * 배선 단계의 체크 상자는 "꽂았는가"만 묻습니다. 맞게 꽂았는지는 묻지 않으므로,
 * VCC와 GND를 바꿔 꽂은 학생도 모든 칸에 표시를 하고 다음으로 넘어갑니다.
 * 그 상태로 USB를 꽂으면 센서가 뜨거워지거나 값이 아예 나오지 않는데, 학생은
 * 무엇을 다시 봐야 하는지 알 방법이 없습니다.
 *
 * 그래서 점검 문항을 레시피마다 손으로 적지 않고 **배선 자체에서** 끌어냅니다.
 * 배선을 고치면 점검도 같이 고쳐집니다.
 */

export interface PowerCheck {
  /** 학생이 눈으로 확인할 한 문장 */
  question: string
  /** 왜 그것을 보는지, 어긋나면 어떻게 되는지 */
  detail: string
}

/** 브레드보드의 전원 레일. `tp`/`bp`가 빨간 줄, `tn`/`bn`이 파란 줄입니다. */
const POSITIVE_RAIL = /^BB\.(tp|bp)\./
const NEGATIVE_RAIL = /^BB\.(tn|bn)\./

function isPowerSource(endpoint: string): boolean {
  return endpoint === 'UNO.5V' || endpoint === 'UNO.3.3V' || POSITIVE_RAIL.test(endpoint)
}

function isGroundSource(endpoint: string): boolean {
  return endpoint === 'UNO.GND' || NEGATIVE_RAIL.test(endpoint)
}

/** 레일끼리 잇는 단계는 부품이 아니므로 점검 목록에 올리지 않습니다. */
function isBoardEndpoint(endpoint: string): boolean {
  const { component } = splitEndpoint(endpoint)
  return component === 'BB' || component === 'UNO'
}

function collect(recipe: Pick<Recipe, 'wiring'>, matches: (endpoint: string) => boolean): string[] {
  const found = new Set<string>()
  for (const step of recipe.wiring) {
    const pairs: Array<[string, string]> = [
      [step.from, step.to],
      [step.to, step.from],
    ]
    for (const [source, other] of pairs) {
      if (matches(source) && !isBoardEndpoint(other)) found.add(other)
    }
  }
  return [...found]
}

/** 극성이 있어 거꾸로 꽂으면 동작하지 않거나 상하는 부품들. */
const POLARITY_NOTES: Record<string, string> = {
  LED: '긴 다리가 +, 짧은 다리가 −입니다. 거꾸로 꽂으면 불이 켜지지 않습니다.',
  CAPACITOR: '옆면에 흰 띠와 −가 인쇄된 쪽이 −입니다. 전해 커패시터를 거꾸로 꽂으면 부풀거나 터질 수 있습니다.',
  BATTERY: '+와 −를 바꿔 꽂으면 보드가 상할 수 있습니다. 표시를 확인하세요.',
  PANEL: '+와 − 단자를 확인하고 연결하세요. 바꿔 꽂으면 전류가 0으로만 측정됩니다.',
  DS18B20: '방수 프로브는 선 색과 실제 핀이 다를 수 있습니다. 판매처의 핀 표를 확인하세요.',
}

export function powerChecks(recipe: Pick<Recipe, 'wiring'>): PowerCheck[] {
  const powered = collect(recipe, isPowerSource)
  const grounded = collect(recipe, isGroundSource)
  const usesRails = recipe.wiring.some(
    (step) => POSITIVE_RAIL.test(step.from) || POSITIVE_RAIL.test(step.to)
      || NEGATIVE_RAIL.test(step.from) || NEGATIVE_RAIL.test(step.to),
  )
  const usesThreeVolt = recipe.wiring.some((step) => step.from === 'UNO.3.3V' || step.to === 'UNO.3.3V')

  const checks: PowerCheck[] = []

  if (powered.length > 0) {
    checks.push({
      question: `전원을 받는 ${powered.length}곳이 모두 빨간 선으로 이어졌는지 짚어 보세요 — ${powered.join(', ')}`,
      detail: 'VCC 자리에 GND 선이 들어가 있으면 센서가 뜨거워집니다. 손끝으로 선을 따라가며 하나씩 확인하세요.',
    })
  }

  if (grounded.length > 0) {
    checks.push({
      question: `GND로 가야 하는 ${grounded.length}곳이 하나도 빠지지 않았는지 확인하세요 — ${grounded.join(', ')}`,
      detail: 'GND가 한 곳이라도 빠지면 값이 나오다 말거나 아무 자극 없이 크게 흔들립니다. 가장 자주 빠뜨리는 선입니다.',
    })
  }

  checks.push(
    usesRails
      ? {
          question: '브레드보드의 빨간 줄과 파란 줄이 어디에서도 서로 닿지 않는지 보세요',
          detail: '두 줄이 한 묶음에서 만나면 전원이 곧바로 GND로 흘러 보드가 뜨거워집니다.',
        }
      : {
          question: '5V에서 나온 선과 GND에서 나온 선이 같은 구멍 묶음에 꽂혀 있지 않은지 보세요',
          detail: '둘이 직접 이어지면 전원이 곧바로 GND로 흘러 보드가 뜨거워집니다.',
        },
  )

  if (usesThreeVolt) {
    checks.push({
      question: '3.3V에 꽂아야 하는 모듈을 5V에 꽂지 않았는지 확인하세요',
      detail: '3.3V 전용 모듈을 5V에 꽂으면 한 번에 손상됩니다. 기판에 인쇄된 전압 표기를 먼저 읽으세요.',
    })
  }

  const polarity = [...new Set(
    recipe.wiring
      .flatMap((step) => [step.from, step.to])
      .map((endpoint) => baseToken(splitEndpoint(endpoint).component))
      .filter((component) => component in POLARITY_NOTES),
  )]
  for (const component of polarity) {
    checks.push({
      question: `${partLabel(component)}의 방향이 맞는지 확인하세요`,
      detail: POLARITY_NOTES[component],
    })
  }

  checks.push({
    question: '점퍼선이 구멍에 끝까지 들어갔는지, 한 칸 밀리지 않았는지 짚어 보세요',
    detail: '한 칸 옆은 다른 묶음이라 연결이 끊깁니다. 겉으로는 꽂힌 것처럼 보여서 화면으로는 알 수 없습니다.',
  })

  checks.push({
    question: 'USB를 꽂은 뒤 부품이 뜨겁거나 탄 냄새가 나면 곧바로 USB를 뽑으세요',
    detail: '몇 초 안에 판단해야 합니다. 뽑은 뒤 위 항목을 처음부터 다시 확인하세요.',
  })

  return checks
}
