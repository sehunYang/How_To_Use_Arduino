import type { Recipe, Subject, TroubleshootingItem, WiringStep } from '@/schema'

/**
 * Phase 7은 앞선 단계가 비워 둔 두 자리를 채웁니다.
 *
 * 1. **출력 장치 예제.** 센서 예제 10건은 모두 "읽기"만 다뤘습니다. LED, 부저,
 *    서보, 릴레이, 모터, LCD를 처음 쓰는 학생이 볼 기초 예제가 하나도 없었고,
 *    LCD1602는 재고에 있으면서 어느 레시피에도 쓰이지 않았습니다.
 * 2. **물리 밖의 분야.** 물리 49건에 견줘 생물 4건, 화학·환경 6건,
 *    공학·로봇 6건뿐이었습니다.
 *
 * 그래서 `createPhase7Recipe`는 Phase 6의 물리 전용 공장과 달리 과목을 받고
 * 구동장치를 함께 선언합니다.
 */

export interface Connection {
  from: string
  to: string
  color: string
  text: string
}

export interface Phase7RecipeInput {
  id: string
  title: string
  /** 출력 장치 예제는 과목이 없습니다(`null`). 나머지는 과목을 갖습니다. */
  subject: Subject | null
  type: Recipe['type']
  difficulty: Recipe['difficulty']
  minutes: number
  sensors?: string[]
  actuators?: string[]
  coreKeywords: string[]
  connections: Connection[]
  sketch: string
  tunable: Recipe['tunables'][number]
  /** 이 레시피가 무엇을 기록하는지. 가이드의 머리말이 됩니다. */
  overview: string
  /** 손으로 하는 측정 순서. 조립 단계는 탐구 설계의 `setup`이 맡습니다. */
  procedure: string
  /** 원리와 한계. 접어 둔 심화 설명이 됩니다. */
  science: string
  /** 안전 안내. 배선 단계 위로 올라갑니다. */
  safety?: string
  applicationGuide: string
  troubleshooting: TroubleshootingItem[]
}

/** 배선 카드가 그림 밖으로 나가지 않도록 5칸씩 줄을 바꿔 배치합니다. */
export function makeWiring(connections: Connection[]): WiringStep[] {
  return connections.map((connection, index) => ({
    ...connection,
    focus: {
      x: 30 + (index % 5) * 190,
      y: 30 + Math.floor(index / 5) * 105,
      w: 165,
      h: 78,
    },
  }))
}

const DEFAULT_SAFETY =
  '전원을 끈 상태에서 배선하고, 전원을 넣기 전에 5V와 GND가 직접 이어지지 않았는지 확인하세요.'

export function createPhase7Recipe(input: Phase7RecipeInput): Recipe {
  const connections = input.connections
  const boardPins = [...new Set(
    connections
      .flatMap((connection) => [connection.from, connection.to])
      .filter((endpoint) => /^UNO\.(?:A\d+|D\d+)$/.test(endpoint))
      .map((endpoint) => endpoint.slice('UNO.'.length)),
  )]
  const declaredPins = new Set(
    [...input.sketch.matchAll(/\/\/ @pin [^=\r\n]+=([A-Z]\d+)/g)].map((match) => match[1]),
  )
  // L1은 `@pin` 매니페스트와 배선을 양방향으로 대조합니다. 빠진 항목을 여기서
  // 채워 두면 레시피마다 같은 목록을 손으로 옮겨 적지 않아도 됩니다.
  const missing = boardPins
    .filter((pin) => !declaredPins.has(pin))
    .map((pin) => `// @pin ${pin}=${pin}`)
    .join('\n')
  const sketch = missing ? `${missing}\n${input.sketch}` : input.sketch

  return {
    id: input.id,
    type: input.type,
    title: input.title,
    subject: input.subject,
    difficulty: input.difficulty,
    minutes: input.minutes,
    board: 'uno-r3',
    sensors: input.sensors ?? [],
    actuators: input.actuators ?? [],
    coreKeywords: input.coreKeywords,
    imageUrl: `wiring/${input.id}.svg`,
    imageWidth: 1100,
    imageHeight: Math.max(800, 138 + Math.floor((connections.length - 1) / 5) * 105),
    wiring: makeWiring(connections),
    sketch,
    // L1이 `@baud`와 대조하므로 스케치에서 읽습니다. 값을 여기 못 박으면
    // 빠르게 표집하는 레시피가 속도를 올릴 수 없습니다.
    baudRate: Number(/\/\/ @baud\s+(\d+)/.exec(sketch)?.[1] ?? 9600),
    tunables: [input.tunable],
    body: `## 탐구 목표

${input.overview}

## 측정 방법

${input.procedure}

:::callout warn
${DEFAULT_SAFETY} ${input.safety ?? ''}
:::

:::toggle 원리·오차까지 보기
${input.science}
:::`,
    applicationGuide: input.applicationGuide,
    troubleshooting: input.troubleshooting,
    status: 'draft',
    reviewedOnDevice: null,
    commentReviewed: null,
    updatedAt: '2026-08-02T00:00:00.000Z',
  }
}

export const contactTroubleshooting: TroubleshootingItem = {
  symptom: '값이 갑자기 튀거나 장치가 제멋대로 동작함',
  cause: '점퍼선이나 브레드보드 접점이 느슨하거나 공통 GND가 빠졌을 수 있습니다.',
  fix: '전원을 끈 뒤 모든 접점을 다시 눌러 꽂고, 모든 장치의 GND가 한 줄로 이어졌는지 확인하세요.',
}

export const i2cTroubleshooting: TroubleshootingItem = {
  symptom: 'I2C 장치가 응답하지 않거나 값이 모두 0임',
  cause: 'SDA/SCL이 바뀌었거나 모듈의 I2C 주소가 코드와 다를 수 있습니다.',
  fix: 'A4=SDA, A5=SCL을 확인하고 I2C 스캐너로 실제 주소를 확인하세요.',
}

export const externalSupplyTroubleshooting: TroubleshootingItem = {
  symptom: '장치를 켜면 아두이노가 다시 시작되거나 값이 흔들림',
  cause: '모터·서보·팬처럼 전류를 많이 쓰는 장치를 아두이노 5V 핀에서 끌어 썼습니다.',
  fix: '구동 전원은 별도 전원에서 가져오고 아두이노와는 GND만 공통으로 묶으세요.',
}
