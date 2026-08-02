import type { Recipe } from '@/schema'

/**
 * 배선 단계의 양 끝은 `MPU6050.VCC`처럼 부품 토큰과 핀 이름을 점으로 이어 적습니다.
 * 이 파일은 그 토큰을 학생이 실제로 손에 쥔 부품과 이어 주는 곳입니다.
 *
 * 레시피는 토큰을 그대로 화면에 보여 줍니다. 모듈 기판에도 같은 글자가
 * 인쇄되어 있어 대조하기 쉽기 때문입니다. 다만 아두이노를 처음 여는 학생은
 * `HBE0704`가 무엇을 재는 물건인지 모르므로, 무엇을 사고 무엇을 꺼내야 하는지
 * 알려 주는 준비물 목록에서는 우리말 이름을 함께 붙입니다.
 */

export interface Endpoint {
  component: string
  pin: string
}

export function splitEndpoint(value: string): Endpoint {
  const separator = value.indexOf('.')
  if (separator === -1) return { component: value, pin: '' }
  return { component: value.slice(0, separator), pin: value.slice(separator + 1) }
}

/**
 * 같은 부품을 여러 개 쓰는 레시피는 `TSL2591_1`, `TSL2591_2`처럼 번호를 붙입니다.
 * 저항만은 접미사가 개수가 아니라 저항값(`RESISTOR_4700` = 4.7 kΩ)이므로
 * 번호를 떼면 안 됩니다.
 */
export function baseToken(component: string): string {
  if (/^RESISTOR_\d+$/.test(component)) return component
  return component.replace(/_\d+$/, '')
}

function ohmLabel(ohms: number): string {
  return ohms >= 1000 ? `${ohms / 1000} kΩ 저항` : `${ohms} Ω 저항`
}

const COMPONENT_LABELS: Record<string, string> = {
  UNO: '아두이노 우노',
  BB: '브레드보드',
  MPU6050: 'MPU6050 가속도·자이로 센서',
  BME280: 'BME280 온습도·기압 센서',
  DS18B20: 'DS18B20 방수 온도 센서',
  'HC-SR04': 'HC-SR04 초음파 거리 센서',
  'HC-SR501': 'HC-SR501 인체 감지 센서',
  TSL2591: 'TSL2591 조도 센서',
  INA219: 'INA219 전류·전압 센서',
  TCA9548A: 'TCA9548A 채널 선택 장치',
  CDS: 'CDS 광저항(조도) 센서',
  HBE0704: 'HBE0704 홀(자기장) 센서',
  LED: 'LED',
  BUZZER: '부저',
  SERVO: 'SG90 서보모터',
  DRIVER: 'DC모터 드라이버',
  FAN: '5V 소형 팬',
  RELAY: '릴레이 모듈',
  PANEL: '태양광 패널',
  CAPACITOR: '커패시터',
  // 부하는 레시피마다 다릅니다. 태양광 레시피는 수십 Ω 저항을, 전류 예제는
  // 220 Ω + LED를 씁니다. 여기에 한 값을 못 박으면 한쪽 레시피가 거짓말을 합니다.
  LOAD: '실험용 부하',
  LAMP: '전구(부하)',
  BATTERY: '실험용 전원',
  FAN_SUPPLY: '팬용 별도 5V 전원',
  SERVO_SUPPLY: '서보용 별도 5V 전원',
  LED_SUPPLY: 'LED용 별도 전원',
  LAMP_SUPPLY: '전구용 별도 전원',
  CDS_RESISTOR: '10 kΩ 저항',
}

/** 배선 단계 제목에 쓰는 짧은 이름. 저항처럼 토큰만으로는 값을 알 수 없는 것만 풀어 씁니다. */
export function shortComponentLabel(component: string): string {
  const base = baseToken(component)
  if (base === 'CDS_RESISTOR') return COMPONENT_LABELS.CDS_RESISTOR
  const resistor = /^RESISTOR_(\d+)$/.exec(base)
  if (resistor) return ohmLabel(Number(resistor[1]))
  if (base === 'LOAD' || base === 'LAMP') return COMPONENT_LABELS[base]
  return component
}

/**
 * 이 토큰을 사람이 읽을 이름으로 옮길 줄 아는지 알려 줍니다. 새 부품을 쓰는
 * 레시피가 들어올 때 준비물 목록에 `HBE0704` 같은 날 토큰이 새어 나가지
 * 않도록 검사에서 씁니다.
 */
export function hasPartLabel(component: string): boolean {
  const base = baseToken(component)
  return /^RESISTOR_\d+$/.test(base) || base in COMPONENT_LABELS
}

/** 준비물 목록에 쓰는 이름. 토큰만으로는 무엇을 사야 할지 알 수 없으므로 우리말을 붙입니다. */
export function partLabel(component: string): string {
  const base = baseToken(component)
  const resistor = /^RESISTOR_(\d+)$/.exec(base)
  if (resistor) return ohmLabel(Number(resistor[1]))
  return COMPONENT_LABELS[base] ?? base
}

const PART_NOTES: Record<string, string> = {
  LOAD: '레시피 본문이 지정한 부하를 쓰세요. LED를 쓴다면 220 Ω 저항을 반드시 직렬로 넣습니다.',
  LAMP: '레시피 본문이 지정한 정격을 확인하세요.',
  FAN_SUPPLY: '아두이노 5V 핀으로는 팬을 돌릴 수 없습니다. 팬 정격에 맞는 전원을 따로 준비하세요.',
  SERVO_SUPPLY: '서보를 아두이노 5V 핀으로 돌리면 보드가 자꾸 다시 켜집니다. 전원을 따로 쓰세요.',
  LED_SUPPLY: '아두이노와 - 극(GND)을 반드시 공통으로 묶습니다.',
  LAMP_SUPPLY: '아두이노와 - 극(GND)을 반드시 공통으로 묶습니다.',
  BATTERY: '- 극을 아두이노 GND와 공통으로 묶어야 측정값이 의미를 가집니다.',
  BME280: '3.3V 전용 모듈은 5V에 꽂으면 손상됩니다. 기판의 전압 표기를 먼저 확인하세요.',
  DS18B20: '방수 프로브는 선 색과 실제 핀이 다를 수 있어 판매처 표를 확인해야 합니다.',
  RELAY: '접점 쪽(COM·NO)에는 아두이노가 아니라 별도 전원을 연결합니다.',
}

/**
 * 배선 토큰이 가리키는 재고 센서의 id. 준비물에서 센서 설명 화면으로 건너가는
 * 데 씁니다. 토큰과 id가 글자 그대로 이어지지 않는 경우(`HC-SR04` ↔ `hc-sr04`,
 * `CDS` ↔ 재고 이름 `CDS 조도센서`)가 있어 표로 둡니다. 표가 재고와 어긋나면
 * 링크가 없는 화면으로 보내게 되므로 검사에서 양방향으로 맞춰 봅니다.
 */
const SENSOR_ID_BY_TOKEN: Record<string, string> = {
  MPU6050: 'mpu6050',
  BME280: 'bme280',
  DS18B20: 'ds18b20',
  'HC-SR04': 'hc-sr04',
  'HC-SR501': 'hc-sr501',
  TSL2591: 'tsl2591',
  INA219: 'ina219',
  TCA9548A: 'tca9548a',
  CDS: 'cds',
  HBE0704: 'hbe0704',
}

export function sensorIdForToken(component: string): string | undefined {
  return SENSOR_ID_BY_TOKEN[baseToken(component)]
}

export const sensorTokens = Object.keys(SENSOR_ID_BY_TOKEN)

export interface PartLine {
  /** 화면에 그대로 적는 부품 이름. */
  name: string
  /** 같은 부품을 몇 개 쓰는지. */
  count: number
  note?: string
  /** 재고에 등록된 센서라면 그 id. 있으면 센서 설명 화면으로 이어 줍니다. */
  sensorId?: string
}

/** 브레드보드와 아두이노 사이 두 끝이 각각 암 소켓인지 보고 점퍼선 종류를 고릅니다. */
export function jumperWireLabel(from: string, to: string): string {
  const endpoints = [from, to].map((endpoint) => splitEndpoint(endpoint).component.toUpperCase())
  const femaleSocketCount = endpoints.filter(
    (endpoint) => endpoint === 'UNO' || endpoint === 'BB' || endpoint.includes('BREADBOARD'),
  ).length
  if (femaleSocketCount === 2) return '수-수(MM) 점퍼선'
  if (femaleSocketCount === 1) return '수-암(MF) 점퍼선'
  return '암-암(FF) 점퍼선'
}

export interface PartsList {
  /** 어떤 레시피를 하든 필요한 것. */
  always: PartLine[]
  /** 이 레시피에서만 필요한 부품. */
  specific: PartLine[]
  /** 종류별 점퍼선 개수. */
  wires: PartLine[]
}

/**
 * 배선 단계에 적힌 부품을 세어 준비물 목록을 만듭니다.
 *
 * 목록을 레시피마다 손으로 적지 않고 배선에서 끌어내는 이유는, 손으로 적은
 * 목록은 배선을 고칠 때 같이 고쳐지지 않고 조용히 어긋나기 때문입니다.
 * 34개 레시피 중 준비물을 따로 적어 둔 것은 일부뿐이었고, 나머지는 학생이
 * 배선 단계를 끝까지 읽어야만 무엇이 필요한지 알 수 있었습니다.
 */
export function partsFor(recipe: Pick<Recipe, 'wiring'>): PartsList {
  const instances = new Map<string, Set<string>>()
  const wireCounts = new Map<string, number>()

  for (const step of recipe.wiring) {
    for (const endpoint of [step.from, step.to]) {
      const { component } = splitEndpoint(endpoint)
      if (component === 'UNO' || component === 'BB') continue
      const base = baseToken(component)
      const seen = instances.get(base) ?? new Set<string>()
      seen.add(component)
      instances.set(base, seen)
    }
    const wire = jumperWireLabel(step.from, step.to)
    wireCounts.set(wire, (wireCounts.get(wire) ?? 0) + 1)
  }

  const specific = [...instances].map(([base, tokens]) => ({
    name: partLabel(base),
    count: tokens.size,
    note: PART_NOTES[base],
    sensorId: SENSOR_ID_BY_TOKEN[base],
  }))

  return {
    always: [
      { name: '아두이노 우노 R3 보드', count: 1 },
      { name: 'USB 케이블 (A–B형)', count: 1, note: '보드를 컴퓨터에 연결하고 전원도 함께 공급합니다.' },
      { name: '브레드보드', count: 1, note: '센서와 저항을 꽂아 고정하고 전원을 나눠 주는 판입니다.' },
    ],
    specific,
    wires: [...wireCounts].map(([name, count]) => ({ name, count })),
  }
}
