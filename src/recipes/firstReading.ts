import type { Recipe } from '@/schema'

/**
 * 시리얼 모니터에 **처음 나온 값이 정상인지** 가려내는 표.
 *
 * 지금까지 화면은 열 이름과 단위는 알려 주었지만, 그 자리에 어떤 값이 나와야
 * 정상인지는 어디에도 없었습니다. 그래서 `-127.00`이나 계속 `0`처럼 배선이
 * 끊겼을 때만 나오는 값을 보고도 측정이 되고 있다고 믿고, 한 시간을 다 쓴 뒤
 * 데이터 화면에서야 이상하다는 것을 알게 됩니다.
 *
 * 표를 레시피가 아니라 **센서**에 붙여 두는 이유는, 같은 센서를 쓰는 레시피가
 * 몇 개든 고장 신호는 똑같기 때문입니다. 센서를 하나 새로 들이면 여기 한 줄만
 * 적으면 그 센서를 쓰는 모든 레시피가 함께 받습니다.
 */

/** USB로 받은 첫 줄들에서 숫자로 읽힌 열 하나. 값은 받은 순서대로입니다. */
export interface LiveColumn {
  name: string
  values: number[]
}

export interface ReadingSignal {
  /** 시리얼 모니터에서 눈으로 알아볼 수 있는 모습 */
  sign: string
  /** 그 값이 뜻하는 것과 무엇을 다시 볼지 */
  meaning: string
  /**
   * USB로 받는 중에 이 신호를 기계가 알아보는 법. 사람 눈에만 보이는 신호
   * (손으로 가려도 그대로 등)는 비워 둡니다. 열은 이 센서의 값으로 보이는 것만 옵니다.
   */
  detect?: (columns: LiveColumn[]) => boolean
  /** 이 센서의 값이 담긴 열 이름의 모양. 비우면 측정값 열 전부를 봅니다. */
  columns?: RegExp
  /**
   * 이 신호를 판단하는 데 필요한 행 수. 어두운 상자 안의 조도처럼 정상인데도 한동안
   * 0에 머무는 값은 기본값보다 훨씬 오래 봐야 합니다.
   */
  minimumRows?: number
}

export interface SensorReading {
  /** 배선이 맞을 때 나오는 값의 크기. 학생이 자기 값과 견줄 기준입니다. */
  normal: string
  signals: ReadingSignal[]
}

/** 처음 나온 값을 판단하기에 충분한 행 수. 리셋 직후 한두 줄로는 붙어 있는지 알 수 없습니다. */
export const MIN_LIVE_ROWS = 8

/** 처음 나온 값을 보는 데 이만큼이면 충분합니다. 뒤 줄까지 매번 다시 읽으면 화면이 느려집니다. */
export const LIVE_CHECK_LINES = 40

const isConstant = (values: number[]) => values.every((value) => value === values[0])
const stuckAt = (target: number) => (columns: LiveColumn[]) =>
  columns.some((column) => column.values.every((value) => value === target))
const stuckAtAny = (targets: number[]) => (columns: LiveColumn[]) =>
  targets.some((target) => stuckAt(target)(columns))
const allZero = (minimumColumns: number) => (columns: LiveColumn[]) =>
  columns.length >= minimumColumns && columns.every((column) => column.values.every((value) => value === 0))
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const MPU_COLUMNS = /accel|gyro|mps2|(^|_)a[xyz](_|$)|g_norm|dynamic_g|tilt|roll|pitch/i
/**
 * I2C가 끊기면 읽기가 0xFFFF(-1)로 돌아옵니다. 가공 전 값을 찍는 스케치는 -1이나
 * 32767에 붙고, g나 m/s²로 나눠 찍는 스케치는 -0.0001처럼 0 바로 아래의 음수에 붙습니다.
 * 살아 있는 센서는 잡음 때문에 여덟 줄이 똑같을 수 없고, 가만히 둔 센서가 2 g를 넘을 수도 없습니다.
 */
const mpuStuck = (columns: LiveColumn[]) =>
  columns.some((column) => {
    const first = column.values[0]
    if (!isConstant(column.values)) return false
    return [-1, 32767, -32768].includes(first) || Math.abs(first) >= 2 || (first < 0 && first > -0.01)
  })

const READINGS: Record<string, SensorReading> = {
  ds18b20: {
    normal: '교실에서 15~30 °C 사이의 값이 소수점까지 흔들리며 나옵니다.',
    signals: [
      {
        sign: '-127.00이 나옵니다',
        meaning: '센서를 찾지 못한 것입니다. DATA 선이 빠졌거나, DATA와 VCC 사이의 4.7 kΩ 저항이 없습니다.',
        detect: stuckAt(-127),
      },
      {
        sign: '85.00이 계속 나옵니다',
        meaning: '전원은 들어왔지만 아직 한 번도 온도를 재지 못한 상태의 기본값입니다. 전원과 DATA 선을 다시 꽂으세요.',
        detect: stuckAt(85),
      },
      {
        sign: '0.00에서 움직이지 않습니다',
        meaning: '값을 읽어 오지 못하고 있습니다. GND가 아두이노 GND와 이어져 있는지 확인하세요.',
        columns: /temp|_c$|water|object|ambient|dry|wet/i,
        detect: stuckAt(0),
      },
    ],
  },
  bme280: {
    normal: '교실에서 온도 15~30 °C, 습도 20~80 %RH, 기압 950~1030 hPa 부근이 나옵니다.',
    signals: [
      {
        sign: '온도·습도·기압이 모두 0입니다',
        meaning: '센서를 찾지 못했습니다. SDA는 A4, SCL은 A5에 꽂혔는지, 모듈 주소가 0x76인지 0x77인지 확인하세요.',
        columns: /temp|humid|press|hpa|altitude/i,
        detect: allZero(2),
      },
      {
        sign: '기압이 300 hPa보다 낮거나 1100 hPa보다 높습니다',
        meaning: '측정할 수 없는 값입니다. I2C 선이 헐거우면 이렇게 뜬금없는 숫자가 섞입니다.',
        columns: /press|hpa/i,
        detect: (columns) => columns.some((column) => {
          const typical = median(column.values)
          return typical < 300 || typical > 1100
        }),
      },
      {
        sign: '온도만 40 °C를 넘습니다',
        meaning: '고장이 아니라 손이나 발열 부품이 가까이 있는 것입니다. 센서를 떨어뜨려 놓고 다시 재세요.',
      },
    ],
  },
  mpu6050: {
    normal: '평평한 책상에 두면 한 축만 중력만큼(약 9.8 m/s² 또는 가공 전 값 약 16384) 나오고 나머지 두 축과 자이로는 0 근처입니다.',
    signals: [
      {
        sign: '가속도·자이로 값이 모두 0입니다',
        meaning: '센서를 찾지 못했습니다. VCC·GND와 A4·A5를 확인하세요.',
        columns: MPU_COLUMNS,
        detect: allZero(1),
      },
      {
        sign: '-1이나 32767 같은 값에 붙어 움직이지 않습니다',
        meaning: 'I2C 통신이 끊겼을 때 나오는 값입니다. A4·A5 배선을 확인하세요.',
        columns: MPU_COLUMNS,
        detect: mpuStuck,
      },
    ],
  },
  ina219: {
    normal: '부하를 달지 않으면 전류는 0 mA 근처, 전압은 공급 전압(약 5 V) 근처가 나옵니다.',
    signals: [
      {
        sign: '전류가 정확히 0.00에서 전혀 움직이지 않습니다',
        meaning: '전류가 VIN+와 VIN−를 지나가지 않고 있습니다. 부하를 이 두 단자 사이에 직렬로 넣어야 합니다.',
        columns: /current|_ma$|bus_v|voltage_v|_v$/i,
        minimumRows: LIVE_CHECK_LINES,
        // 전압은 들어오는데 전류만 0이어야 부하가 빠진 것입니다. 전압도 0이면 아래 신호의 일입니다.
        detect: (columns) =>
          columns.some((column) => /current|_ma$/i.test(column.name) && column.values.every((value) => value === 0))
          && columns.filter((column) => !/current|_ma$/i.test(column.name)).every((column) => Math.abs(median(column.values)) >= 0.2),
      },
      {
        sign: '전압이 0에 가깝습니다',
        meaning: '측정할 회로에 전원이 들어오지 않았습니다. 부하 쪽 전원과 공통 GND를 확인하세요.',
        columns: /bus_v|voltage_v|_v$/i,
        detect: (columns) => columns.some((column) => Math.abs(median(column.values)) < 0.2),
      },
    ],
  },
  tsl2591: {
    normal: '형광등을 켠 교실에서 수십~수백 lux가 나오고, 센서를 손으로 가리면 곧바로 크게 줄어듭니다.',
    signals: [
      {
        sign: '0에서 움직이지 않습니다',
        meaning: '센서를 찾지 못했습니다. 주소가 0x29로 고정된 센서라 두 개를 붙이면 이렇게 됩니다.',
        columns: /lux|light/i,
        // 어두운 상자 안에서는 정상인 센서도 한동안 0.00을 찍습니다.
        minimumRows: LIVE_CHECK_LINES,
        detect: stuckAt(0),
      },
      {
        sign: '손으로 가려도 값이 그대로입니다',
        meaning: '읽은 값이 측정 범위를 넘어 최댓값에 머물러 있습니다. 빛을 모으는 시간이나 증폭 정도를 낮추세요.',
      },
    ],
  },
  cds: {
    normal: '0~1023 사이의 값이 나오고, 손으로 가리면 수백 단위로 바뀝니다.',
    signals: [
      {
        sign: '0이나 1023에 붙어 손으로 가려도 바뀌지 않습니다',
        meaning: '전압을 나눠 주는 10 kΩ 저항이 빠졌거나, 읽는 아날로그 핀 선이 빠졌습니다.',
        columns: /light|ldr|cds|analog|_adc$/i,
        detect: stuckAtAny([0, 1023]),
      },
      {
        sign: '값이 아무 자극 없이 크게 널뜁니다',
        meaning: 'GND가 이어지지 않았을 때 나타나는 모습입니다. 접지 선부터 확인하세요.',
      },
    ],
  },
  'hc-sr04': {
    normal: '앞에 둔 물체까지의 실제 거리와 비슷한 cm 값이 나옵니다.',
    signals: [
      {
        sign: '0이 나옵니다',
        meaning: '되돌아온 초음파를 받지 못했습니다. 물체가 2 cm보다 가깝거나, TRIG·ECHO 선이 서로 바뀌었습니다.',
        columns: /dist/i,
        detect: stuckAt(0),
      },
      {
        sign: '항상 400 언저리의 같은 값이 나옵니다',
        meaning: '반사가 돌아오지 않아 최대 시간까지 기다린 것입니다. 센서를 평평한 벽 쪽으로 돌려 보세요.',
        columns: /dist/i,
        detect: (columns) => columns.some((column) => {
          // m로 찍는 스케치는 같은 시간 초과가 4 m 언저리로 나옵니다.
          const limit = /_m$/i.test(column.name) ? 3.5 : 350
          return column.values[0] >= limit && isConstant(column.values)
        }),
      },
    ],
  },
  'hc-sr501': {
    normal: '가만히 있으면 0, 센서 앞에서 손을 흔들면 1로 바뀌었다가 잠시 뒤 0으로 돌아옵니다.',
    signals: [
      {
        sign: '계속 1입니다',
        meaning: '전원을 켠 직후에는 안정될 때까지 1분 정도 걸립니다. 그 뒤에도 계속 1이면 모듈의 유지 시간 조절 나사를 줄이세요.',
        columns: /motion|pir|occupied/i,
        detect: stuckAt(1),
      },
      {
        sign: '움직여도 계속 0입니다',
        meaning: 'OUT 선이 꽂힌 디지털 핀이 코드에 적힌 핀과 같은지 확인하세요.',
      },
    ],
  },
  hbe0704: {
    normal: '자석이 없을 때 일정한 기준값이 나오고, 자석을 가까이 대면 한쪽 방향으로 크게 움직입니다.',
    signals: [
      {
        sign: '0이나 1023에 붙어 있습니다',
        meaning: '전원이나 출력 선이 빠졌습니다. 모듈 버전에 따라 기준값이 다르므로 자석 없이 먼저 재 두세요.',
        columns: /hall|^raw$|magnet/i,
        detect: stuckAtAny([0, 1023]),
      },
      {
        sign: '자석을 대도 값이 바뀌지 않습니다',
        meaning: '자석의 극 방향이 반대일 수 있습니다. 자석을 뒤집어 대 보세요.',
      },
    ],
  },
  tca9548a: {
    normal: '채널을 바꿔 가며 읽은 값이 센서마다 서로 다르게 나옵니다.',
    signals: [
      {
        sign: '어느 채널을 골라도 같은 값이 나옵니다',
        meaning: '채널이 바뀌지 않았습니다. 센서가 SD0/SC0처럼 채널 쪽 핀에 꽂혔는지 확인하세요.',
      },
    ],
  },
}

/** 센서와 상관없이 처음 한 시간에 그대로 겪는 것들. */
const COMMON_SIGNALS: ReadingSignal[] = [
  {
    sign: 'nan이 나옵니다',
    meaning: '센서를 찾지 못해 값을 계산할 수 없는 상태입니다. 전원과 통신 선(A4·A5 또는 데이터 핀)을 확인하세요.',
  },
  {
    sign: '아무 줄도 나오지 않습니다',
    meaning: '업로드가 끝났는지, [도구] → [포트]가 우리 보드로 골라져 있는지 확인하세요.',
  },
  {
    sign: '알아볼 수 없는 기호만 나옵니다',
    meaning: '시리얼 모니터 오른쪽 아래 속도가 코드의 속도와 다릅니다.',
  },
  {
    sign: '열 이름 줄만 나오고 값이 따라 나오지 않습니다',
    meaning: '센서를 준비하는 단계에서 멈춘 것입니다. 전원과 통신 선(A4·A5 또는 데이터 핀)을 확인하세요.',
  },
]

export interface FirstReadingGuide {
  normal: string[]
  signals: ReadingSignal[]
}

/**
 * 이 레시피가 쓰는 센서의 정상값과 고장 신호를 모읍니다. 표를 갖고 있지 않은
 * 센서는 **아무 줄도 만들지 않습니다.** 지어낸 정상 범위는 학생이 자기 값과
 * 견주는 기준이 되므로, 틀린 기준을 주는 것이 기준을 안 주는 것보다 나쁩니다.
 */
export function firstReadingFor(recipe: Pick<Recipe, 'sensors'>): FirstReadingGuide {
  const known = recipe.sensors.map((sensorId) => READINGS[sensorId]).filter(Boolean)
  return {
    normal: known.map((reading) => reading.normal),
    signals: [...known.flatMap((reading) => reading.signals), ...COMMON_SIGNALS],
  }
}

export const sensorsWithReadingGuide = Object.keys(READINGS)

/**
 * 측정값이 아니라 구분자·상태·횟수인 열. 이런 열은 0에 붙어 있는 것이 정상이므로
 * 고장 신호를 찾을 때 뺍니다.
 */
const NOT_A_READING = /^time_|^commanded_|(^|_)(id|index|channel|event|position|duty|state|count|on|lamp|direction|polarity)$/i

/** 받은 행에서 숫자로만 된 열을 골라냅니다. 빈 칸이나 숫자가 아닌 값이 하나라도 있는 열은 값 열이 아닙니다. */
export function numericLiveColumns(header: readonly string[], rows: readonly (readonly string[])[]): LiveColumn[] {
  return header.flatMap((name, index) => {
    if (NOT_A_READING.test(name)) return []
    const raw = rows.map((row) => row[index] ?? '')
    if (raw.some((field) => field === '')) return []
    const values = raw.map(Number)
    if (values.some((value) => !Number.isFinite(value))) return []
    return [{ name, values }]
  })
}

/** 값을 계산하지 못한 라이브러리는 nan을 찍습니다. 숫자 열이 아니라고 버리면 가장 확실한 신호를 놓칩니다. */
function hasNanColumn(header: readonly string[], rows: readonly (readonly string[])[]) {
  return header.some((name, index) =>
    !NOT_A_READING.test(name) && rows.every((row) => /^[-+]?(nan|inf)$/i.test(row[index] ?? '')))
}

/**
 * USB로 받는 중에, 이 레시피의 센서가 고장났을 때만 나오는 값이 보이는지.
 * 위 표의 `detect`를 가진 신호만 봅니다. 행이 적을 때는 아무것도 답하지 않습니다.
 */
export function liveReadingSignals(
  sensors: readonly string[],
  header: readonly string[],
  rows: readonly (readonly string[])[],
): ReadingSignal[] {
  if (rows.length < MIN_LIVE_ROWS) return []
  const nanSignal = hasNanColumn(header, rows) ? [COMMON_SIGNALS[0]] : []
  const columns = numericLiveColumns(header, rows)
  const seen = new Set<string>()
  const sensorSignals = columns.length === 0 ? [] : [...new Set(sensors)]
    .flatMap((sensorId) => READINGS[sensorId]?.signals ?? [])
    .filter((signal) => {
      if (!signal.detect || seen.has(signal.sign)) return false
      if (rows.length < (signal.minimumRows ?? MIN_LIVE_ROWS)) return false
      const relevant = signal.columns ? columns.filter((column) => signal.columns!.test(column.name)) : columns
      if (relevant.length === 0 || !signal.detect(relevant)) return false
      seen.add(signal.sign)
      return true
    })
  return [...nanSignal, ...sensorSignals]
}
