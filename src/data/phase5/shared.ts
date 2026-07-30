import type { Recipe, TroubleshootingItem, WiringStep } from '@/schema'

export interface Connection {
  from: string
  to: string
  color: string
  text: string
}

export interface ProjectRecipeInput {
  id: string
  title: string
  subject: '물리' | '화학·환경'
  difficulty: '초급' | '중급' | '고급'
  minutes: number
  sensors: string[]
  actuators?: string[]
  coreKeywords: string[]
  connections: Connection[]
  sketch: string
  tunable: {
    anchor: string
    name: string
    hint: string
  }
  overview: string
  procedure: string
  science: string
  applicationGuide: string
  troubleshooting: TroubleshootingItem[]
}

export function makeWiring(connections: Connection[]): WiringStep[] {
  return connections.map((connection, index) => {
    const column = index % 4
    const row = Math.floor(index / 4)
    return {
      ...connection,
      focus: {
        x: 40 + column * 190,
        y: 35 + row * 105,
        w: 150,
        h: 70,
      },
    }
  })
}

export function i2cConnections(component: string): Connection[] {
  return [
    { from: `${component}.VCC`, to: 'UNO.5V', color: 'red', text: `${component} VCC를 아두이노 5V에 연결하세요.` },
    { from: `${component}.GND`, to: 'UNO.GND', color: 'black', text: `${component} GND를 아두이노 GND에 연결하세요.` },
    { from: `${component}.SDA`, to: 'UNO.A4', color: 'green', text: `${component} SDA를 아두이노 A4에 연결하세요.` },
    { from: `${component}.SCL`, to: 'UNO.A5', color: 'yellow', text: `${component} SCL을 아두이노 A5에 연결하세요.` },
  ]
}

export function poweredAnalogConnections(component: string, signal = 'OUT'): Connection[] {
  return [
    { from: `${component}.VCC`, to: 'UNO.5V', color: 'red', text: `${component} VCC를 아두이노 5V에 연결하세요.` },
    { from: `${component}.GND`, to: 'UNO.GND', color: 'black', text: `${component} GND를 아두이노 GND에 연결하세요.` },
    { from: `${component}.${signal}`, to: 'UNO.A0', color: 'blue', text: `${component} ${signal}을 아두이노 A0에 연결하세요.` },
  ]
}

export function oneWireConnections(instances: string[]): Connection[] {
  const connections: Connection[] = []
  for (const instance of instances) {
    connections.push(
      { from: `${instance}.VCC`, to: 'UNO.5V', color: 'red', text: `${instance} VCC를 아두이노 5V에 연결하세요.` },
      { from: `${instance}.GND`, to: 'UNO.GND', color: 'black', text: `${instance} GND를 아두이노 GND에 연결하세요.` },
    )
  }
  connections.push({
    from: `${instances.join('+')}.DATA`,
    to: 'UNO.D2',
    color: 'green',
    text: `모든 DS18B20 DATA를 D2에 함께 연결하고 DATA와 5V 사이에 4.7 kΩ 풀업 저항을 연결하세요.`,
  })
  return connections
}

export function createProjectRecipe(input: ProjectRecipeInput): Recipe {
  return {
    id: input.id,
    type: 'project',
    title: input.title,
    subject: input.subject,
    difficulty: input.difficulty,
    minutes: input.minutes,
    board: 'uno-r3',
    sensors: input.sensors,
    actuators: input.actuators ?? [],
    coreKeywords: input.coreKeywords,
    imageUrl: `wiring/${input.id}.svg`,
    imageWidth: 800,
    imageHeight: 600,
    wiring: makeWiring(input.connections),
    sketch: input.sketch,
    baudRate: 9600,
    tunables: [input.tunable],
    body: `## 탐구 목표

${input.overview}

## 측정 방법

${input.procedure}

:::callout warn
전원을 끈 상태에서 배선하고, 전원을 넣기 전에 5V와 GND가 직접 연결되지 않았는지 확인하세요. 센서의 측정 범위를 넘는 조건에서는 실험하지 마세요.
:::

:::toggle 원리·오차까지 보기
${input.science}
:::`,
    applicationGuide: input.applicationGuide,
    troubleshooting: input.troubleshooting,
    status: 'draft',
    reviewedOnDevice: null,
    commentReviewed: null,
    updatedAt: '2026-07-30T00:00:00.000Z',
  }
}

export const i2cTroubleshooting: TroubleshootingItem = {
  symptom: '센서가 응답하지 않거나 값이 모두 0임',
  cause: 'SDA/SCL이 바뀌었거나 모듈의 I2C 주소가 코드와 다를 수 있습니다.',
  fix: 'A4=SDA, A5=SCL을 확인하고 I2C 스캐너로 실제 주소를 확인하세요.',
}

export const contactTroubleshooting: TroubleshootingItem = {
  symptom: '측정값이 갑자기 튀거나 간헐적으로 끊김',
  cause: '점퍼선이나 브레드보드 접점이 느슨하거나 전원 공급이 불안정할 수 있습니다.',
  fix: '전원을 끈 뒤 모든 접점을 다시 눌러 꽂고 공통 GND와 공급 전압을 확인하세요.',
}
