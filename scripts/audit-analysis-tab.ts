/**
 * 레시피별 시리얼 모니터 출력을 실험 설계대로 만들어 데이터 변환·분석 탭의
 * 실제 코드(convertSerialTextToCsv → collectNumericColumns → summarizeRelation)에
 * 그대로 넣고, 탐구 설계가 요구하는 그래프가 나오는지 확인합니다.
 *
 * 값은 물리적으로 그럴듯하게 만들되 난수 씨앗을 고정해 실행할 때마다 같은 결과가
 * 나오게 했습니다.
 */
import { pendulumRecipe, ina219CurrentRecipe, multiTsl2591Recipe } from '../src/data/canary'
import { phase5Recipes } from '../src/data/phase5'
import { phase6Recipes } from '../src/data/phase6'
import { findCsvHeader } from '../src/data/inquiry/columns'
import { convertSerialTextToCsv } from '../src/lib/serialCsv'
import { collectNumericColumns, pairValues, readNamedColumn, summarizeRelation } from '../src/lib/dataStats'
import { MAX_SERIES } from '../src/lib/chartPalette'
import { aggregateByOrder, MAX_TRUSTWORTHY_SPREAD_RATIO } from '../src/lib/trialAnalysis'
import { buildColumns } from '../src/lib/derivedColumns'
import { pivotByColumn, splitRowsByColumn } from '../src/lib/seriesGrouping'
import { cropRows } from '../src/lib/rowRange'
import { RESOLUTIONS } from './audit-analysis-resolutions'

// ── 난수 ──────────────────────────────────────────────────────────────────
let seed = 20260802
function random() {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}
/** 평균 0, 대략 ±amount 범위의 잡음 */
function noise(amount: number) {
  return (random() - 0.5) * 2 * amount
}

type Cell = number | string
type Row = Record<string, Cell>

interface Sim {
  id: string
  /** 실험 조건(= 붙여넣을 회차) 목록 */
  conditions: Array<{ label: string; p: number }>
  /** 조건당 표본 수 */
  n: number
  /** 시간 열의 한 칸 크기(그 열의 단위 그대로) */
  dt: number
  /** i번째 표본에서 출력되는 행(들) */
  row: (i: number, p: number, conditionIndex: number) => Row | Row[]
  /**
   * 탐구 설계가 최종적으로 요구하는 그래프의 두 축.
   * `col:이름`은 CSV에 그대로 있는 열, `calc:설명`은 계산해야 만들어지는 값,
   * `note:설명`은 센서가 기록하지 않아 사람이 따로 적어야 하는 값입니다.
   */
  desired: { x: string; y: string }
  /** 탭에서 바로 그릴 수 있는 중간 그래프(있으면) */
  usable?: { x: string; y: string }
}

const INTEGER_COLUMNS = /(_raw|_adc|_count|channel|index|position|duty|pulses|motion|lamp|fan|occupied|door_state|polarity|event|condition_id|rpm|interrupt_count|_channels|_us)$/

function format(name: string, value: Cell) {
  if (typeof value === 'string') return value
  if (name === 'time_ms' || name === 'time_us') return String(Math.round(value))
  if (INTEGER_COLUMNS.test(name)) return String(Math.round(value))
  return value.toFixed(4)
}

// ── 레시피별 측정값 모델 ──────────────────────────────────────────────────
const G = 9.8

const sims: Sim[] = [
  // 단진자: 길이별로 진동하는 가속도 파형
  {
    id: 'pendulum',
    conditions: [0.2, 0.35, 0.5, 0.65, 0.8].map((p) => ({ label: `실 길이 ${p} m`, p })),
    n: 250,
    dt: 20,
    row: (i, p) => {
      const t = (i * 20) / 1000
      const period = 2 * Math.PI * Math.sqrt(p / G)
      const swing = Math.sin((2 * Math.PI * t) / period)
      return {
        time_ms: i * 20,
        accel_x_raw: 3200 * swing + noise(60),
        accel_y_raw: 400 * swing * swing + noise(60),
        accel_z_raw: 16384 + 1800 * swing * swing + noise(60),
      }
    },
    desired: { x: 'note:실의 길이 L', y: 'calc:봉우리를 세어 구한 T²' },
    usable: { x: 'col:time_ms', y: 'col:accel_x_raw' },
  },
  // INA219 전류: 부하별 원시값
  {
    id: 'ina219-current',
    conditions: [
      { label: '1 kΩ', p: 50 },
      { label: '470 Ω', p: 106 },
      { label: '220 Ω', p: 227 },
      { label: 'LED+220 Ω', p: 98 },
    ],
    n: 30,
    dt: 100,
    row: (i, p) => ({ time_ms: i * 100, current_raw: p + noise(3) }),
    desired: { x: 'note:연결한 부하', y: 'calc:평균 current_raw ÷ 10 으로 구한 전류' },
    usable: { x: 'col:time_ms', y: 'col:current_raw' },
  },
  // 같은 주소 센서 두 개: 채널 0·1을 번갈아 출력
  {
    id: 'multi-tsl2591',
    conditions: [{ label: '창가/안쪽', p: 0 }],
    n: 40,
    dt: 500,
    row: (i) => [
      { time_ms: i * 500, channel: 0, light_raw: 8200 + noise(150) },
      { time_ms: i * 500 + 120, channel: 1, light_raw: 2400 + noise(90) },
    ],
    desired: { x: 'col:time_ms', y: 'col:light_raw (채널별로 나눠서)' },
    usable: { x: 'col:time_ms', y: 'col:light_raw' },
  },
  {
    id: 'S1',
    conditions: [0, 30, 45, 60, 90].map((p) => ({ label: `${p}°`, p })),
    n: 30,
    dt: 100,
    row: (i, p) => ({ time_ms: i * 100, roll_deg: p + noise(0.6), pitch_deg: noise(0.5) }),
    desired: { x: 'note:각도기로 잰 실제 각도', y: 'col:roll_deg' },
    usable: { x: 'col:time_ms', y: 'col:roll_deg' },
  },
  {
    id: 'S2',
    conditions: [10, 20, 40, 80, 160].map((p) => ({ label: `${p} cm`, p })),
    n: 20,
    dt: 100,
    row: (i, p) => ({ time_ms: i * 100, distance_cm: p * 1.01 + noise(0.4) }),
    desired: { x: 'note:자로 잰 실제 거리', y: 'col:distance_cm' },
    usable: { x: 'col:time_ms', y: 'col:distance_cm' },
  },
  {
    id: 'S3',
    conditions: [1, 2, 3, 4].map((p) => ({ label: `${p} m`, p })),
    n: 120,
    dt: 200,
    row: (i, p) => ({ time_ms: i * 200, motion: i % 30 < 4 && random() < 1 / p ? 1 : 0 }),
    desired: { x: 'note:지나간 거리', y: 'calc:motion이 0→1로 바뀐 사건 수' },
    usable: { x: 'col:time_ms', y: 'col:motion' },
  },
  {
    id: 'S4',
    conditions: [0, 1, 2, 3, 4].map((p) => ({ label: `필터 ${p}장`, p })),
    n: 20,
    dt: 100,
    row: (i, p) => ({ time_ms: i * 100, light_adc: 60 + 700 * Math.pow(0.55, p) + noise(4) }),
    desired: { x: 'note:겹친 필터 장수', y: 'col:light_adc' },
    usable: { x: 'col:time_ms', y: 'col:light_adc' },
  },
  {
    id: 'S5',
    conditions: [
      { label: '얼음물', p: 1.5 },
      { label: '실온', p: 22 },
      { label: '따뜻한 물', p: 41 },
    ],
    n: 60,
    dt: 1000,
    row: (i, p) => ({ time_ms: i * 1000, water_c: p + (24 - p) * Math.exp(-i / 8) + noise(0.06) }),
    desired: { x: 'col:time_ms', y: 'col:water_c' },
  },
  {
    id: 'S6',
    conditions: [{ label: '교실', p: 0 }],
    n: 60,
    dt: 2000,
    row: (i) => {
      const temperature = 21 + 4 * (i / 60) + noise(0.05)
      return {
        time_ms: i * 2000,
        temperature_c: temperature,
        humidity_pct: 62 - 2.4 * (temperature - 21) + noise(0.3),
        pressure_hpa: 1008.4 + noise(0.05),
      }
    },
    desired: { x: 'col:temperature_c', y: 'col:humidity_pct' },
  },
  {
    id: 'S7',
    conditions: [
      { label: '1 kΩ', p: 1000 },
      { label: '470 Ω', p: 470 },
      { label: '220 Ω', p: 220 },
    ],
    n: 30,
    dt: 200,
    row: (i, p) => {
      const voltage = 5 - 0.02 * (5000 / p) + noise(0.004)
      const current = (voltage / p) * 1000
      return { time_ms: i * 200, voltage_v: voltage, current_ma: current, power_mw: voltage * current }
    },
    desired: { x: 'col:current_ma', y: 'col:voltage_v' },
  },
  {
    id: 'S8',
    conditions: [10, 20, 40, 80].map((p) => ({ label: `${p} cm`, p })),
    n: 20,
    dt: 200,
    row: (i, p) => ({ time_ms: i * 200, lux: 12 + 40000 / (p * p) + noise(1.2) }),
    desired: { x: 'note:광원까지 거리', y: 'col:lux' },
    usable: { x: 'col:time_ms', y: 'col:lux' },
  },
  {
    id: 'S9',
    conditions: [{ label: '창가/안쪽', p: 0 }],
    n: 40,
    dt: 500,
    row: (i) => [
      { time_ms: i * 500, channel: 0, light_raw: 9100 + noise(180) },
      { time_ms: i * 500 + 130, channel: 1, light_raw: 3050 + noise(110) },
    ],
    desired: { x: 'col:time_ms', y: 'col:light_raw (채널별로 나눠서)' },
    usable: { x: 'col:time_ms', y: 'col:light_raw' },
  },
  {
    id: 'S10',
    conditions: [1, 2, 3, 5].map((p) => ({ label: `${p} cm`, p })),
    n: 30,
    dt: 100,
    row: (_i, p) => {
      const signed = 260 / (p * p * p)
      const raw = 512 + signed + noise(2)
      return {
        raw,
        polarity: raw >= 512 ? 'positive' : 'negative',
        relative_strength: Math.abs(raw - 512),
      }
    },
    desired: { x: 'note:자석까지 거리', y: 'col:relative_strength' },
  },
  {
    id: 'p1-pendulum-period',
    conditions: [0.2, 0.35, 0.5, 0.65, 0.8].map((p) => ({ label: `실 길이 ${p} m`, p })),
    n: 250,
    dt: 20,
    row: (i, p) => {
      const t = (i * 20) / 1000
      const period = 2 * Math.PI * Math.sqrt(p / G)
      return { time_ms: i * 20, ax_mps2: 2.4 * Math.sin((2 * Math.PI * t) / period) + noise(0.05) }
    },
    desired: { x: 'note:실의 길이 L', y: 'calc:봉우리를 세어 구한 T²' },
    usable: { x: 'col:time_ms', y: 'col:ax_mps2' },
  },
  {
    id: 'p2-mechanical-energy',
    conditions: [0.05, 0.1, 0.15].map((p) => ({ label: `높이 ${p} m`, p })),
    n: 200,
    dt: 20,
    row: (i, p) => {
      const t = (i * 20) / 1000
      const period = 1.4
      const phase = Math.cos((2 * Math.PI * t) / period)
      const peak = 1 + (2 * p) / 0.5
      const gNorm = 1 + (peak - 1) * phase * phase * Math.exp(-t / 12)
      return {
        time_ms: i * 20,
        ax: 0.4 * Math.sin((2 * Math.PI * t) / period) + noise(0.01),
        ay: noise(0.01),
        az: gNorm - 0.05 + noise(0.01),
        g_norm: gNorm + noise(0.008),
      }
    },
    desired: { x: 'note:놓은 높이', y: 'calc:봉우리 g_norm에서 구한 운동에너지' },
    usable: { x: 'col:time_ms', y: 'col:g_norm' },
  },
  {
    id: 'free-fall',
    conditions: [1.0, 1.5, 2.0].map((p) => ({ label: `높이 ${p} m`, p })),
    n: 60,
    dt: 20,
    row: (i, p) => {
      const t = Math.max(0, (i - 10) * 0.02)
      const fallen = Math.min(p, 0.5 * G * t * t)
      return { time_ms: i * 20, distance_m: p - fallen + noise(0.002) }
    },
    desired: { x: 'calc:낙하 시작을 0으로 맞춘 t²', y: 'calc:떨어진 거리' },
    usable: { x: 'col:time_ms', y: 'col:distance_m' },
  },
  {
    id: 'p4-friction-energy-loss',
    conditions: [
      { label: '나무 바닥', p: 0.25 },
      { label: '천 바닥', p: 0.45 },
      { label: '고무 바닥', p: 0.7 },
    ],
    n: 80,
    dt: 50,
    row: (i, p) => {
      const t = i * 0.05
      const speed = Math.max(0, 1.6 - p * G * t)
      return {
        time_ms: i * 50,
        distance_m: 0.2 + 1.6 * t - 0.5 * p * G * t * t * (speed > 0 ? 1 : 0) + noise(0.003),
        ax_mps2: (speed > 0 ? -p * G : 0) + noise(0.05),
      }
    },
    desired: { x: 'note:바닥 재질', y: 'calc:거리-시간에서 구한 속도로 계산한 손실 에너지' },
    usable: { x: 'col:time_ms', y: 'col:distance_m' },
  },
  {
    id: 'p5-incline-acceleration',
    conditions: [5, 10, 15, 20, 25].map((p) => ({ label: `${p}°`, p })),
    n: 60,
    dt: 50,
    row: (i, p) => ({
      time_ms: i * 50,
      along_mps2: (i > 10 && i < 45 ? 0.35 * Math.sin((p * Math.PI) / 180) * G : 0) + noise(0.08),
      tilt_deg: p + noise(0.3),
    }),
    desired: { x: 'calc:sin θ', y: 'calc:a = 2s/Δt²' },
    usable: { x: 'col:time_ms', y: 'col:along_mps2' },
  },
  {
    id: 'p6-magnetic-field-distance',
    conditions: [1, 1.5, 2, 3, 4, 5].map((p) => ({ label: `${p} cm`, p })),
    n: 30,
    dt: 100,
    row: (i, p) => {
      const signed = 300 / (p * p * p)
      return { time_ms: i * 100, raw: 512 + signed + noise(1.5), signed_relative_field: signed + noise(1.5) }
    },
    desired: { x: 'calc:log(거리)', y: 'calc:log(상대 세기)' },
    usable: { x: 'col:time_ms', y: 'col:signed_relative_field' },
  },
  {
    id: 'p7-solar-panel-angle',
    conditions: [0, 15, 30, 45, 60, 75].map((p) => ({ label: `${p}°`, p })),
    n: 30,
    dt: 200,
    row: (i, p) => {
      const cos = Math.cos((p * Math.PI) / 180)
      const voltage = 2.4 * Math.sqrt(cos) + noise(0.01)
      const current = 42 * cos + noise(0.3)
      return {
        time_ms: i * 200,
        voltage_v: voltage,
        current_ma: current,
        power_mw: voltage * current,
        lux: 21000 * cos + noise(120),
        power_density_mw_cm2: (voltage * current) / 25,
      }
    },
    desired: { x: 'calc:cos θ', y: 'calc:0°일 때로 나눈 상대 전류' },
    usable: { x: 'col:lux', y: 'col:power_mw' },
  },
  {
    id: 'p8-inverse-square-light',
    conditions: [{ label: '거리 6단계 한 번에', p: 0 }],
    n: 6,
    dt: 200,
    row: (i) => {
      const distance = [0.2, 0.4, 0.6, 0.9, 1.2, 1.5][i]
      const lux = 18 + 900 / (distance * distance) + noise(2)
      return {
        time_ms: i * 4000,
        distance_m: distance,
        mean_lux: lux,
        d2_times_lux: distance * distance * lux,
      }
    },
    desired: { x: 'calc:log(distance_m)', y: 'calc:log(주변광을 뺀 mean_lux)' },
    usable: { x: 'col:distance_m', y: 'col:mean_lux' },
  },
  {
    id: 'fan-control',
    conditions: [60, 65, 70].map((p) => ({ label: `기준 ${p}%`, p })),
    n: 120,
    dt: 2,
    row: (i, p) => {
      const humidity = 58 + 14 * Math.sin(i / 18) + noise(0.4)
      return {
        time_s: i * 2,
        temperature_c: 24 + 1.5 * Math.sin(i / 25) + noise(0.05),
        humidity_percent: humidity,
        fan: humidity > p ? 1 : 0,
      }
    },
    desired: { x: 'col:time_s', y: 'col:humidity_percent' },
  },
  {
    id: 'e2-reaction-temperature',
    conditions: [
      { label: '발열 2 g', p: 6 },
      { label: '발열 4 g', p: 11 },
    ],
    n: 90,
    dt: 2,
    row: (i, p) => ({
      time_s: i * 2,
      temperature_c: 22 + (i < 30 ? 0 : p * (1 - Math.exp(-(i - 30) / 10)) * Math.exp(-(i - 30) / 120)) + noise(0.03),
    }),
    desired: { x: 'col:time_s', y: 'col:temperature_c' },
  },
  {
    id: 'cooling-curve',
    conditions: [
      { label: '뚜껑 없음', p: 0.011 },
      { label: '뚜껑 있음', p: 0.006 },
    ],
    n: 90,
    dt: 5,
    row: (i, p) => {
      const excess = 55 * Math.exp(-p * i * 5)
      return { time_s: i * 5, temperature_c: 23 + excess + noise(0.04), excess_temperature_c: excess + noise(0.04) }
    },
    desired: { x: 'col:time_s', y: 'calc:ln(excess_temperature_c)' },
    usable: { x: 'col:time_s', y: 'col:excess_temperature_c' },
  },
  {
    id: 'e4-weather-pressure',
    conditions: [{ label: '48시간 기록', p: 0 }],
    n: 96,
    dt: 30,
    row: (i) => {
      const pressure = 1012 - 6 * Math.sin(i / 30) - 0.02 * i + noise(0.08)
      return { time_min: i * 30, pressure_hpa: pressure, relative_altitude_m: (1013.25 - pressure) * 8.3 }
    },
    desired: { x: 'col:time_min', y: 'col:pressure_hpa' },
  },
  {
    id: 'e5-spatial-light-map',
    conditions: [{ label: '격자 1행', p: 0 }],
    n: 20,
    dt: 500,
    row: (i) => [0, 1, 2].map((channel) => ({
      time_ms: i * 500 + channel * 30,
      position: channel,
      lux: [820, 430, 180][channel] + noise(12),
    })),
    desired: { x: 'note:격자 좌표', y: 'col:lux (위치별로 나눠서)' },
    usable: { x: 'col:time_ms', y: 'col:lux' },
  },
  {
    id: 'e6-multi-point-temperature',
    conditions: [{ label: '3지점', p: 0 }],
    n: 40,
    dt: 1750,
    row: (i) => [0, 1, 2].map((index) => ({
      time_ms: i * 1750 + index * 20,
      index,
      temperature_c: [58 - 30 * (1 - Math.exp(-i / 20)), 34 + 6 * (1 - Math.exp(-i / 20)), 24 + 2 * (1 - Math.exp(-i / 20))][index] + noise(0.05),
    })),
    desired: { x: 'col:time_ms', y: 'calc:같은 시각 위치별 온도 차' },
    usable: { x: 'col:time_ms', y: 'col:temperature_c' },
  },
  {
    id: 'plant-growth',
    conditions: [
      { label: '밝은 자리', p: 12000 },
      { label: '그늘', p: 2200 },
    ],
    n: 96,
    dt: 900000,
    row: (i, p) => ({
      time_ms: i * 900000,
      lux: Math.max(5, p * Math.sin((i / 96) * Math.PI * 2 - Math.PI / 2) + p) + noise(80),
      temperature_c: 23 + 3 * Math.sin((i / 96) * Math.PI * 2) + noise(0.05),
      humidity_pct: 55 - 6 * Math.sin((i / 96) * Math.PI * 2) + noise(0.3),
    }),
    desired: { x: 'note:날짜', y: 'note:자로 잰 생장 길이' },
    usable: { x: 'col:time_ms', y: 'col:lux' },
  },
  {
    id: 'night-activity',
    conditions: [{ label: '하룻밤', p: 0 }],
    n: 200,
    dt: 1000,
    row: (i) => {
      const dark = i > 60 && i < 160
      const motion = random() < (dark ? 0.12 : 0.02) ? 1 : 0
      darkCount += dark && motion ? 1 : 0
      return {
        time_ms: i * 1000,
        light_adc: dark ? 90 + noise(8) : 640 + noise(20),
        motion,
        dark_motion_count: darkCount,
      }
    },
    desired: { x: 'calc:1분 단위 구간', y: 'calc:시간당 사건 수' },
    usable: { x: 'col:time_ms', y: 'col:dark_motion_count' },
  },
  {
    id: 'photosynthesis-light-control',
    conditions: [4000, 8000, 12000].map((p) => ({ label: `목표 ${p} lux`, p })),
    n: 120,
    dt: 1000,
    row: (i, p) => {
      const lamp = Math.sin(i / 7) > 0 ? 1 : 0
      return { time_ms: i * 1000, lux: p * (lamp ? 1 : 0.15) + noise(p * 0.02), lamp }
    },
    desired: { x: 'calc:하루 동안 받은 빛의 총량', y: 'note:생장 지표' },
    usable: { x: 'col:time_ms', y: 'col:lux' },
  },
  {
    id: 'human-activity-meter',
    conditions: [
      { label: '정지', p: 0.01 },
      { label: '걷기', p: 0.22 },
      { label: '빠르게 걷기', p: 0.48 },
    ],
    n: 120,
    dt: 100,
    row: (i, p) => ({
      time_ms: i * 100,
      dynamic_g: Math.abs(p * Math.sin(i / 2.2) + noise(p * 0.35 + 0.005)),
      active_fraction: Math.min(1, p * 2.1 + noise(0.01)),
    }),
    desired: { x: 'note:활동 종류', y: 'col:dynamic_g 의 분포' },
    usable: { x: 'col:time_ms', y: 'col:dynamic_g' },
  },
  {
    id: 'obstacle-avoid-car',
    conditions: [
      { label: '느림', p: 0.4 },
      { label: '보통', p: 0.8 },
      { label: '빠름', p: 1.4 },
    ],
    n: 80,
    dt: 100,
    row: (i, p) => ({
      time_ms: i * 100,
      distance_cm: Math.max(6, 120 - p * i * 1.6) + noise(0.8),
      tilt_x_g: noise(0.05),
    }),
    desired: { x: 'note:주행 속도', y: 'calc:정지까지 이동한 거리' },
    usable: { x: 'col:time_ms', y: 'col:distance_cm' },
  },
  {
    id: 'light-follow-car',
    conditions: [
      { label: '간격 6 cm', p: 6 },
      { label: '간격 12 cm', p: 12 },
    ],
    n: 90,
    dt: 100,
    row: (i, p) => {
      const angle = 40 * Math.cos(i / 12)
      const left = 500 + p * 8 * Math.sin((angle * Math.PI) / 180) + noise(4)
      const right = 500 - p * 8 * Math.sin((angle * Math.PI) / 180) + noise(4)
      return { time_ms: i * 100, left_adc: left, right_adc: right, error: left - right }
    },
    desired: { x: 'note:광원을 놓은 각도', y: 'col:error' },
    usable: { x: 'col:time_ms', y: 'col:error' },
  },
  {
    id: 'automatic-door',
    conditions: [3, 5, 10].map((p) => ({ label: `유지 ${p}초`, p })),
    n: 150,
    dt: 200,
    row: (i, p) => ({ time_ms: i * 200, door_state: i % 40 < p * 5 ? 1 : 0 }),
    desired: { x: 'note:유지 시간 조건', y: 'calc:감지 성공률과 통과 중 닫힘 횟수' },
    usable: { x: 'col:time_ms', y: 'col:door_state' },
  },
  {
    id: 'parking-alarm',
    conditions: [20, 40, 60].map((p) => ({ label: `경보 ${p} cm`, p })),
    n: 60,
    dt: 100,
    row: (i, _p) => ({ time_ms: i * 100, distance_cm: Math.max(5, 90 - i * 1.2) + noise(0.6) + (random() < 0.03 ? -100 : 0) }),
    desired: { x: 'note:자로 잰 실제 거리', y: 'col:distance_cm' },
    usable: { x: 'col:time_ms', y: 'col:distance_cm' },
  },
  {
    id: 'rpm-meter',
    conditions: [
      { label: '느림', p: 60 },
      { label: '보통', p: 150 },
      { label: '빠름', p: 300 },
    ],
    n: 60,
    dt: 1000,
    row: (i, p) => {
      const rpm = p + noise(p * 0.06)
      return { time_ms: i * 1000, pulses: Math.round((rpm / 60) * 2), rpm }
    },
    desired: { x: 'col:time_ms', y: 'col:rpm' },
  },
  {
    id: 'smart-lighting',
    conditions: [10, 30, 60].map((p) => ({ label: `유지 ${p}초`, p })),
    n: 200,
    dt: 500,
    row: (i, p) => {
      const occupied = i % 60 < 12 ? 1 : 0
      return {
        time_ms: i * 500,
        light_adc: i > 80 ? 120 + noise(10) : 600 + noise(20),
        occupied,
        lamp: i > 80 && i % 60 < 12 + p / 5 ? 1 : 0,
      }
    },
    desired: { x: 'note:유지 시간 조건', y: 'calc:총 점등 시간' },
    usable: { x: 'col:time_ms', y: 'col:light_adc' },
  },
  {
    id: 's11-tsl2591-interrupt',
    conditions: [{ label: '기준 1000/10000', p: 0 }],
    n: 120,
    dt: 50,
    row: (i) => {
      const light = 5000 + 6000 * Math.sin(i / 15)
      const crossed = i > 0 && Math.sin(i / 15) > 0.83 && i % 47 === 0
      if (crossed) interruptCount += 1
      return {
        event: crossed ? 'INT' : 'sample',
        time_ms: i * 50,
        interrupt_count: interruptCount,
        light_raw: light + noise(40),
      }
    },
    desired: { x: 'col:time_ms', y: 'col:light_raw + event=INT 표시' },
    usable: { x: 'col:time_ms', y: 'col:light_raw' },
  },
  {
    id: 's12-dual-mpu6050-address',
    conditions: [{ label: '동시에 흔들기', p: 0 }],
    n: 120,
    dt: 50,
    row: (i) => {
      const shake = 4200 * Math.sin(i / 4)
      return {
        time_ms: i * 50,
        mpu_0x68_accel_x_raw: shake + noise(80),
        mpu_0x69_accel_x_raw: shake * 0.97 + 140 + noise(80),
      }
    },
    desired: { x: 'col:time_ms', y: 'col:mpu_0x68_accel_x_raw' },
  },
  {
    id: 'p9-motion-interrupt',
    conditions: [
      { label: '스펀지', p: 6 },
      { label: '골판지', p: 12 },
      { label: '맨 바닥', p: 22 },
    ],
    n: 120,
    dt: 2000,
    row: (i, p) => {
      const t = i - 40
      const impact = Math.abs(t) < 8 ? p * Math.exp(-(t * t) / 12) : 0
      return {
        time_us: i * 2000,
        acceleration_x_g: impact + noise(0.03),
        acceleration_y_g: noise(0.03),
        acceleration_z_g: 1 + noise(0.03),
      }
    },
    desired: { x: 'col:time_us', y: 'col:acceleration_x_g' },
  },
  {
    id: 's13-mpu-aux-tsl2591',
    conditions: [{ label: '조명 켬/끔', p: 0 }],
    n: 100,
    dt: 100,
    row: (i) => ({
      time_ms: i * 100,
      acceleration_x_g: (i > 50 ? 0.5 : 0) + noise(0.02),
      acceleration_y_g: noise(0.02),
      acceleration_z_g: (i > 50 ? 0.86 : 1) + noise(0.02),
      light_raw: i % 40 < 20 ? 14000 + noise(200) : 900 + noise(60),
    }),
    desired: { x: 'col:time_ms', y: 'col:light_raw' },
  },
  {
    id: 's14-tca-address-reset',
    conditions: [{ label: '리셋 50회', p: 0 }],
    n: 50,
    dt: 1000,
    row: (i) => ({
      time_ms: i * 1000,
      mux_0x70_recovery_us: 420 + noise(60),
      mux_0x70_channels: 0,
      mux_0x71_recovery_us: 480 + noise(90),
      mux_0x71_channels: random() < 0.06 ? 1 : 0,
    }),
    desired: { x: 'col:time_ms', y: 'col:mux_0x70_recovery_us (분포 비교)' },
  },
  {
    id: 'p10-eight-point-light-field',
    conditions: [
      { label: '차광판 없음', p: 1 },
      { label: '차광판 있음', p: 0.4 },
    ],
    n: 30,
    dt: 500,
    row: (i, p) => {
      const base: Row = { time_ms: i * 500 }
      for (let channel = 0; channel < 8; channel += 1) {
        const shade = channel >= 3 && channel <= 5 ? p : 1
        base[`light_ch${channel}_raw`] = (9000 - channel * 420) * shade + noise(120)
      }
      return base
    },
    desired: { x: 'note:센서 격자 좌표', y: 'col:8개 채널 값을 색으로 나타낸 2×4 표' },
    usable: { x: 'col:time_ms', y: 'col:light_ch0_raw 외 (한 번에 3개까지)' },
  },
  {
    id: 'ph01-uniform-motion',
    conditions: [
      { label: '느림', p: 0.22 },
      { label: '보통', p: 0.41 },
      { label: '빠름', p: 0.63 },
    ],
    n: 60,
    dt: 100,
    row: (i, p) => ({ time_ms: i * 100, distance_m: 0.15 + p * i * 0.1 + noise(0.004) }),
    desired: { x: 'col:time_ms', y: 'col:distance_m' },
  },
  {
    id: 'ph02-newton-second-law',
    conditions: [0.5, 0.6, 0.7, 0.85, 1.0].map((p) => ({ label: `${p} kg`, p })),
    n: 60,
    dt: 50,
    row: (i, p) => {
      const acceleration = 1.4 / p
      return {
        time_ms: i * 50,
        acceleration_x_g: (i > 10 && i < 45 ? acceleration / G : 0) + noise(0.01),
        acceleration_y_g: noise(0.01),
        acceleration_z_g: 1 + noise(0.01),
      }
    },
    desired: { x: 'calc:1/m', y: 'calc:가속 구간의 평균 가속도' },
    usable: { x: 'col:time_ms', y: 'col:acceleration_x_g' },
  },
  {
    id: 'ph03-projectile-motion',
    conditions: [0.1, 0.15, 0.2].map((p) => ({ label: `놓는 높이 ${p} m`, p })),
    n: 50,
    dt: 50,
    row: (i, p) => {
      const speed = Math.sqrt(2 * G * p) * 0.8
      return {
        time_ms: i * 50,
        distance_m: Math.max(0.05, 1.2 - speed * i * 0.05) + noise(0.003),
        acceleration_x_g: noise(0.02),
      }
    },
    desired: { x: 'col:time_ms', y: 'col:distance_m' },
  },
  {
    id: 'ph04-momentum-collision',
    conditions: [
      { label: '질량비 1:1', p: 1 },
      { label: '질량비 1:2', p: 2 },
    ],
    n: 100,
    dt: 20,
    row: (i, p) => {
      const t = i - 50
      const pulse = Math.abs(t) < 5 ? Math.exp(-(t * t) / 6) : 0
      return {
        time_ms: i * 20,
        mpu0_ax_g: -3.2 * pulse + noise(0.02),
        mpu1_ax_g: (3.2 / p) * pulse + noise(0.02),
      }
    },
    desired: { x: 'col:time_ms', y: 'col:mpu0_ax_g' },
  },
  {
    id: 'ph05-restitution-coefficient',
    conditions: [
      { label: '고무공', p: 0.8 },
      { label: '탁구공', p: 0.7 },
      { label: '나무공', p: 0.4 },
    ],
    n: 120,
    dt: 20,
    row: (i, p) => {
      const t = i * 0.02
      const bounce = Math.abs(Math.sin(t * 4)) * Math.pow(p, Math.floor((t * 4) / Math.PI))
      return { time_ms: i * 20, distance_m: 1.0 - 0.9 * bounce + noise(0.003) }
    },
    desired: { x: 'calc:첫 낙하 높이 h₁', y: 'calc:첫 반발 높이 h₂' },
    usable: { x: 'col:time_ms', y: 'col:distance_m' },
  },
  {
    id: 'ph06-spring-oscillation',
    conditions: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3].map((p) => ({ label: `${p} kg`, p })),
    n: 200,
    dt: 20,
    row: (i, p) => {
      const period = 2 * Math.PI * Math.sqrt(p / 18)
      const t = i * 0.02
      return {
        time_ms: i * 20,
        acceleration_x_g: noise(0.01),
        acceleration_y_g: noise(0.01),
        acceleration_z_g: 1 + 0.3 * Math.sin((2 * Math.PI * t) / period) + noise(0.01),
      }
    },
    desired: { x: 'note:매단 질량', y: 'calc:봉우리를 세어 구한 T²' },
    usable: { x: 'col:time_ms', y: 'col:acceleration_z_g' },
  },
  {
    id: 'ph07-centripetal-acceleration',
    conditions: [0.1, 0.15, 0.2, 0.25].map((p) => ({ label: `반경 ${p} m`, p })),
    n: 60,
    dt: 100,
    row: (i, p) => {
      const omega = 4.2
      return {
        time_ms: i * 100,
        acceleration_x_g: (omega * omega * p) / G + noise(0.02),
        acceleration_y_g: noise(0.02),
        acceleration_z_g: 1 + noise(0.02),
        gyro_z_dps: (omega * 180) / Math.PI + noise(1.2),
      }
    },
    desired: { x: 'calc:ω² (gyro_z_dps에서 변환)', y: 'col:반지름 방향 가속도' },
    usable: { x: 'col:gyro_z_dps', y: 'col:acceleration_x_g' },
  },
  {
    id: 'ph08-rpm-comparison',
    conditions: [10, 18, 25, 32, 40].map((p) => ({ label: `${p} RPM`, p })),
    n: 40,
    dt: 500,
    row: (i, p) => {
      const rps = p / 60
      pulseCount += Math.round(rps * 2 * 0.5)
      return {
        time_ms: i * 500,
        gyro_z_dps: rps * 360 + noise(1.5),
        hall_raw: 480 + noise(40),
        pulse_count: pulseCount,
        pulse_interval_us: Math.round(1e6 / (rps * 2)) + noise(400),
      }
    },
    desired: { x: 'calc:홀 센서 RPM', y: 'calc:자이로 RPM' },
    usable: { x: 'col:time_ms', y: 'col:gyro_z_dps' },
  },
  {
    id: 'ph09-friction-coefficients',
    conditions: [
      { label: '나무', p: 0.32 },
      { label: '고무', p: 0.62 },
      { label: '유리', p: 0.18 },
    ],
    n: 100,
    dt: 100,
    row: (i, p) => {
      const angle = Math.min(Math.atan(p), (i * 0.006))
      return {
        time_ms: i * 100,
        acceleration_x_g: Math.sin(angle) + noise(0.005),
        acceleration_y_g: noise(0.005),
        acceleration_z_g: Math.cos(angle) + noise(0.005),
      }
    },
    desired: { x: 'note:접촉면 재료', y: 'calc:arcsin(acceleration_x_g)로 구한 시작각의 탄젠트' },
    usable: { x: 'col:time_ms', y: 'col:acceleration_x_g' },
  },
  {
    id: 'ph10-rotational-damping',
    conditions: [
      { label: '펠트', p: 0.09 },
      { label: '고무', p: 0.21 },
      { label: '종이', p: 0.05 },
    ],
    n: 60,
    dt: 500,
    row: (i, p) => {
      const omega = 220 * Math.exp(-p * i * 0.5)
      pulseCount += Math.round((omega / 360) * 2 * 0.5)
      return {
        time_ms: i * 500,
        gyro_z_dps: omega + noise(1.5),
        hall_raw: 470 + noise(35),
        pulse_count: pulseCount,
        pulse_interval_us: Math.round(1e6 / Math.max(0.2, (omega / 360) * 2)),
      }
    },
    desired: { x: 'col:time_ms', y: 'calc:ln(ω/ω₀)' },
    usable: { x: 'col:time_ms', y: 'col:gyro_z_dps' },
  },
  {
    id: 'ph11-specific-heat',
    conditions: [
      { label: '물', p: 0.08 },
      { label: '식용유', p: 0.17 },
    ],
    n: 40,
    dt: 1750,
    row: (i, p) => [0, 1].map((index) => ({
      time_ms: i * 1750 + index * 20,
      index,
      temperature_c: 22 + (index === 0 ? p : p * 0.55) * i * 1.75 + noise(0.05),
    })),
    desired: { x: 'col:time_ms', y: 'col:temperature_c (index별로 나눠서)' },
    usable: { x: 'col:time_ms', y: 'col:temperature_c' },
  },
  {
    id: 'ph12-latent-heat',
    conditions: [{ label: '얼음물 가열', p: 0 }],
    n: 120,
    dt: 5,
    row: (i) => {
      const t = i * 5
      const temperature = t < 100 ? -8 + 0.08 * t : t < 380 ? 0 + noise(0.05) : (t - 380) * 0.05
      return { time_s: t, temperature_c: temperature + noise(0.04) }
    },
    desired: { x: 'col:time_s', y: 'col:temperature_c' },
  },
  {
    id: 'ph13-thermal-conductivity',
    conditions: [
      { label: '알루미늄', p: 1.2 },
      { label: '철', p: 3.4 },
      { label: '나무', p: 9.1 },
    ],
    n: 40,
    dt: 1750,
    row: (i, p) => [0, 1].map((index) => ({
      time_ms: i * 1750 + index * 20,
      index,
      temperature_c: index === 0
        ? 70 - 20 * Math.exp(-i / 12) + noise(0.05)
        : 24 + (46 / p) * (1 - Math.exp(-i / 12)) + noise(0.05),
    })),
    desired: { x: 'note:막대 재료', y: 'calc:정상 상태의 양 끝 온도 차' },
    usable: { x: 'col:time_ms', y: 'col:temperature_c' },
  },
  {
    id: 'ph14-insulation-performance',
    conditions: [
      { label: '스티로폼', p: 0.0009 },
      { label: '천', p: 0.0016 },
      { label: '없음', p: 0.0031 },
    ],
    n: 90,
    dt: 10000,
    row: (i, p) => {
      const excess = 52 * Math.exp(-p * i * 10)
      return {
        time_ms: i * 10000,
        object_temperature_c: 23 + excess + noise(0.04),
        ambient_temperature_c: 23 + noise(0.05),
        humidity_pct: 48 + noise(0.4),
      }
    },
    desired: { x: 'col:time_ms', y: 'calc:ln((대상−주변)/처음 온도 차)' },
    usable: { x: 'col:time_ms', y: 'col:object_temperature_c' },
  },
  {
    id: 'ph15-gas-temperature-pressure',
    conditions: [{ label: '온도 5단계 한 번에', p: 0 }],
    n: 50,
    dt: 2000,
    row: (i) => {
      const temperature = 5 + i * 1.4
      return {
        time_ms: i * 2000,
        temperature_c: temperature + noise(0.05),
        pressure_hpa: 1010 * ((temperature + 273.15) / 278.15) + noise(0.3),
      }
    },
    desired: { x: 'col:temperature_c', y: 'col:pressure_hpa' },
  },
  {
    id: 'ph16-altitude-pressure',
    conditions: [0, 4, 8, 12].map((p) => ({ label: `${p} m`, p })),
    n: 30,
    dt: 1000,
    row: (i, p) => ({
      time_ms: i * 1000,
      temperature_c: 22 + noise(0.05),
      pressure_hpa: 1013.2 - p * 0.118 + noise(0.03),
    }),
    desired: { x: 'note:기준층에서 잰 높이', y: 'col:pressure_hpa' },
    usable: { x: 'col:time_ms', y: 'col:pressure_hpa' },
  },
  {
    id: 'ph17-ohms-law',
    conditions: [
      { label: 'R1K', p: 1000 },
      { label: 'R2K2', p: 2200 },
      { label: 'R4K7', p: 4700 },
    ],
    n: 9,
    dt: 800,
    row: (i, p, conditionIndex) => {
      const duty = 26 + (i % 9) * 26
      const voltage = (duty / 255) * 5
      const current = (voltage / p) * 1000
      return {
        condition_id: ['R1K', 'R2K2', 'R4K7'][conditionIndex],
        duty,
        bus_V: voltage + noise(0.004),
        shunt_mV: current * 0.1 + noise(0.01),
        current_mA: current + noise(0.02),
      }
    },
    desired: { x: 'col:current_mA', y: 'col:bus_V' },
  },
  {
    id: 'ph18-series-parallel-resistance',
    conditions: [
      { label: '직렬', p: 690 },
      { label: '병렬', p: 150 },
    ],
    n: 30,
    dt: 500,
    row: (i, p, conditionIndex) => {
      const voltage = 5 + noise(0.01)
      const current = (voltage / p) * 1000
      return {
        condition_id: ['SERIES', 'PARALLEL'][conditionIndex],
        time_ms: i * 500,
        bus_V: voltage,
        current_mA: current + noise(0.05),
        equivalent_ohm: (voltage / current) * 1000,
      }
    },
    desired: { x: 'note:연결 방식', y: 'col:equivalent_ohm' },
    usable: { x: 'col:time_ms', y: 'col:equivalent_ohm' },
  },
  {
    id: 'ph19-kirchhoff-laws',
    conditions: [
      { label: 'TOTAL', p: 150 },
      { label: 'BRANCH_220', p: 220 },
      { label: 'BRANCH_470', p: 470 },
    ],
    n: 30,
    dt: 500,
    row: (i, p, conditionIndex) => {
      const voltage = 5 + noise(0.008)
      const current = (voltage / p) * 1000
      return {
        condition_id: ['TOTAL', 'BRANCH_220', 'BRANCH_470'][conditionIndex],
        time_ms: i * 500,
        bus_V: voltage,
        shunt_mV: current * 0.1 + noise(0.01),
        current_mA: current + noise(0.05),
      }
    },
    desired: { x: 'note:측정 지점', y: 'calc:지점별 평균 전류의 합 비교' },
    usable: { x: 'col:time_ms', y: 'col:current_mA' },
  },
  {
    id: 'ph20-joule-heating',
    conditions: [
      { label: 'HEATING', p: 1 },
      { label: 'COOLING', p: 0 },
    ],
    n: 90,
    dt: 1000,
    row: (i, p, conditionIndex) => {
      const voltage = p ? 5 + noise(0.01) : 0
      const current = p ? 45 + noise(0.2) : 0
      return {
        condition_id: ['HEATING', 'COOLING'][conditionIndex],
        time_ms: i * 1000,
        bus_V: voltage,
        current_mA: current,
        power_W: (voltage * current) / 1000,
        temperature_C: p
          ? 23 + 18 * (1 - Math.exp(-i / 30)) + noise(0.05)
          : 23 + 18 * Math.exp(-i / 30) + noise(0.05),
      }
    },
    desired: { x: 'col:time_ms', y: 'col:temperature_C' },
  },
  {
    id: 'ph21-rc-time-constant',
    conditions: [
      { label: 'CHARGE', p: 1 },
      { label: 'DISCHARGE', p: 0 },
    ],
    n: 80,
    dt: 250,
    row: (i, p, conditionIndex) => {
      const tau = 10
      const voltage = p ? 5 * (1 - Math.exp(-i / tau)) : 5 * Math.exp(-i / tau)
      return {
        condition_id: ['CHARGE', 'DISCHARGE'][conditionIndex],
        time_ms: i * 250,
        capacitor_V: voltage + noise(0.006),
        current_mA: (p ? 1 : -1) * 0.5 * Math.exp(-i / tau) + noise(0.002),
      }
    },
    desired: { x: 'col:time_ms', y: 'calc:ln(capacitor_V)' },
    usable: { x: 'col:time_ms', y: 'col:capacitor_V' },
  },
  {
    id: 'ph22-battery-internal-resistance',
    conditions: [
      { label: 'OPEN', p: 1e9 },
      { label: '470 Ω', p: 470 },
      { label: '220 Ω', p: 220 },
      { label: '100 Ω', p: 100 },
    ],
    n: 30,
    dt: 500,
    row: (i, p, conditionIndex) => {
      const emf = 1.58
      const internal = 0.42
      const current = (emf / (p + internal)) * 1000
      return {
        condition_id: ['OPEN', 'R470', 'R220', 'R100'][conditionIndex],
        time_ms: i * 500,
        terminal_V: emf - (internal * current) / 1000 + noise(0.001),
        current_mA: current + noise(0.03),
      }
    },
    desired: { x: 'col:current_mA', y: 'col:terminal_V' },
  },
  {
    id: 'ph23-solar-iv-mpp',
    conditions: [
      { label: '밝은 광원', p: 1 },
      { label: '어두운 광원', p: 0.55 },
    ],
    n: 7,
    dt: 2000,
    row: (i, p, conditionIndex) => {
      const load = [10000, 4700, 2200, 1000, 470, 220, 100][i]
      const shortCircuit = 38 * p
      const voltage = 2.6 * p * (1 - Math.exp(-load / 900))
      const current = Math.min(shortCircuit, (voltage / load) * 1000)
      return {
        condition_id: ['BRIGHT', 'DIM'][conditionIndex],
        time_ms: i * 2000,
        panel_V: voltage + noise(0.005),
        current_mA: current + noise(0.05),
        power_mW: voltage * current,
        light_raw: 22000 * p + noise(150),
      }
    },
    desired: { x: 'col:panel_V', y: 'col:current_mA 와 power_mW' },
  },
  {
    id: 'ph24-solenoid-current-field',
    conditions: [
      { label: 'I000', p: 0 },
      { label: 'I050', p: 50 },
      { label: 'I100', p: 100 },
      { label: 'I150', p: 150 },
    ],
    n: 30,
    dt: 500,
    row: (i, p, conditionIndex) => ({
      condition_id: ['I000', 'I050', 'I100', 'I150'][conditionIndex],
      time_ms: i * 500,
      current_mA: p + noise(0.4),
      hall_raw: 512 + p * 0.62 + noise(1.5),
    }),
    desired: { x: 'col:current_mA', y: 'col:hall_raw' },
  },
  {
    id: 'ph25-coil-turns-field',
    conditions: [
      { label: 'N50', p: 50 },
      { label: 'N100', p: 100 },
      { label: 'N150', p: 150 },
    ],
    n: 30,
    dt: 500,
    row: (i, p, conditionIndex) => ({
      condition_id: ['N50', 'N100', 'N150'][conditionIndex],
      time_ms: i * 500,
      current_mA: 120 + noise(0.4),
      hall_raw: 512 + p * 0.31 + noise(1.5),
    }),
    desired: { x: 'note:코일의 감은 수 N', y: 'col:hall_raw' },
    usable: { x: 'col:time_ms', y: 'col:hall_raw' },
  },
  {
    id: 'ph26-rotating-magnet-signal',
    conditions: [
      { label: '자석 2개·느림', p: 2 },
      { label: '자석 4개·빠름', p: 4 },
    ],
    n: 40,
    dt: 500,
    row: (i, p) => {
      const rps = 0.8 * p
      pulseCount += Math.round(rps * p * 0.5)
      return {
        time_ms: i * 500,
        hall_raw: 470 + noise(40),
        pulse_count: pulseCount,
        pulse_interval_us: Math.round(1e6 / (rps * p)) + noise(300),
      }
    },
    desired: { x: 'note:자석 수와 회전 속도', y: 'calc:pulse_interval_us에서 구한 주파수' },
    usable: { x: 'col:time_ms', y: 'col:pulse_count' },
  },
  {
    id: 'ph27-magnetic-shielding',
    conditions: [
      { label: '재료 없음', p: 1 },
      { label: '알루미늄', p: 0.92 },
      { label: '철판', p: 0.35 },
    ],
    n: 30,
    dt: 200,
    row: (i, p) => ({ time_ms: i * 200, hall_raw: 512 + 180 * p + noise(1.5) }),
    desired: { x: 'note:삽입 재료와 두께', y: 'calc:영점을 뺀 hall_raw로 구한 차폐율' },
    usable: { x: 'col:time_ms', y: 'col:hall_raw' },
  },
  {
    id: 'ph28-malus-law',
    conditions: Array.from({ length: 19 }, (_unused, index) => ({ label: `${index * 10}°`, p: index * 10 })),
    n: 30,
    dt: 200,
    row: (i, p) => {
      const cos = Math.cos((p * Math.PI) / 180)
      return { time_ms: i * 200, light_raw: 120 + 26000 * cos * cos + noise(60) }
    },
    desired: { x: 'calc:cos²θ', y: 'calc:기준값을 뺀 light_raw' },
    usable: { x: 'col:time_ms', y: 'col:light_raw' },
  },
  {
    id: 'ph29-transmittance-absorbance',
    conditions: [0, 1, 2, 4, 8].map((p) => ({ label: `농도 ${p}`, p })),
    n: 30,
    dt: 200,
    row: (i, p) => ({ time_ms: i * 200, light_raw: 90 + 24000 * Math.exp(-0.28 * p) + noise(50) }),
    desired: { x: 'note:색소 농도', y: 'calc:log(I₀/I)로 구한 흡광도' },
    usable: { x: 'col:time_ms', y: 'col:light_raw' },
  },
  {
    id: 'ph30-reflection-intensity-angle',
    conditions: [-40, -20, -6, 0, 6, 20, 40].map((p) => ({ label: `${p}°`, p })),
    n: 20,
    dt: 200,
    row: (i, p) => ({ time_ms: i * 200, light_raw: 200 + 18000 * Math.exp(-(p * p) / 60) + noise(40) }),
    desired: { x: 'note:센서 각도', y: 'calc:광원을 끈 값을 뺀 light_raw' },
    usable: { x: 'col:time_ms', y: 'col:light_raw' },
  },
  {
    id: 'ph31-lens-focal-length',
    conditions: [0.15, 0.2, 0.25, 0.3, 0.4].map((p) => ({ label: `u=${p} m`, p })),
    n: 20,
    dt: 200,
    row: (i, _p) => {
      // 센서를 앞뒤로 옮기며 가장 밝은 자리를 찾는 과정을 그대로 흉내 냅니다.
      const offset = (i - 10) * 0.005
      return { time_ms: i * 200, light_raw: 300 + 20000 * Math.exp(-(offset * offset) / 0.0002) + noise(50) }
    },
    desired: { x: 'calc:1/u', y: 'calc:1/v' },
    usable: { x: 'col:time_ms', y: 'col:light_raw' },
  },
  {
    id: 'ph32-aperture-light',
    conditions: [1, 2, 3, 4, 6].map((p) => ({ label: `지름 ${p} mm`, p })),
    n: 20,
    dt: 200,
    row: (i, p) => ({ time_ms: i * 200, light_raw: 80 + 620 * p * p + noise(30) }),
    desired: { x: 'calc:d²', y: 'calc:기준값을 뺀 light_raw' },
    usable: { x: 'col:time_ms', y: 'col:light_raw' },
  },
  {
    id: 'ph33-light-source-stability',
    conditions: [
      { label: 'LED', p: 0.004 },
      { label: '형광등', p: 0.03 },
    ],
    n: 200,
    dt: 200,
    row: (i, p) => ({
      time_ms: i * 200,
      light_raw: 14000 * (1 - 0.06 * Math.exp(-i / 40)) * (1 + noise(p)),
    }),
    desired: { x: 'col:time_ms', y: 'col:light_raw' },
  },
  {
    id: 'ph34-torricelli-drain',
    conditions: [{ label: '배출 전체', p: 0 }],
    n: 80,
    dt: 500,
    row: (i) => {
      const height = Math.max(0, Math.pow(Math.sqrt(0.25) - 0.0042 * i * 0.5, 2))
      return { time_ms: i * 500, distance_m: 0.45 - height + noise(0.002) }
    },
    desired: { x: 'col:time_ms', y: 'calc:√h (센서-배출구 거리에서 계산)' },
    usable: { x: 'col:time_ms', y: 'col:distance_m' },
  },
  {
    id: 'ph35-temperature-speed-of-sound',
    conditions: [8, 16, 24, 32].map((p) => ({ label: `${p} °C`, p })),
    n: 30,
    dt: 100,
    row: (i, p) => {
      const speed = 331.3 + 0.606 * p
      const trueDistance = 0.8
      const echo = (trueDistance * 2000000) / speed
      return {
        time_ms: i * 100,
        temperature_c: p + noise(0.05),
        pressure_hpa: 1009 + noise(0.1),
        echo_time_us: echo + noise(6),
        distance_m: (echo * speed) / 2000000 + noise(0.001),
      }
    },
    desired: { x: 'col:temperature_c', y: 'calc:실제 거리와 보정 전 거리의 차' },
    usable: { x: 'col:temperature_c', y: 'col:distance_m' },
  },
]

// 누적 값을 쓰는 스케치용 전역 상태
let darkCount = 0
let interruptCount = 0
let pulseCount = 0

// ── 실행 ──────────────────────────────────────────────────────────────────
const recipes = [pendulumRecipe, ina219CurrentRecipe, multiTsl2591Recipe, ...phase5Recipes, ...phase6Recipes]
const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]))

interface Report {
  id: string
  title: string
  header: string[]
  verdict: string
  detail: string[]
}

const reports: Report[] = []

function buildSerialText(sim: Sim, header: string[], conditionIndex: number): string {
  darkCount = 0
  interruptCount = 0
  pulseCount = 0
  const condition = sim.conditions[conditionIndex]
  const lines = [header.join(',')]
  for (let i = 0; i < sim.n; i += 1) {
    const produced = sim.row(i, condition.p, conditionIndex)
    for (const record of Array.isArray(produced) ? produced : [produced]) {
      const missing = header.filter((name) => record[name] === undefined)
      if (missing.length > 0) throw new Error(`${sim.id}: 열 ${missing.join(', ')} 값을 만들지 않았습니다.`)
      lines.push(header.map((name) => format(name, record[name])).join(','))
    }
  }
  return lines.join('\r\n')
}

function columnOf(spec: string) {
  return spec.startsWith('col:') ? spec.slice(4) : null
}

for (const sim of sims) {
  const recipe = recipeById.get(sim.id)
  if (!recipe) {
    reports.push({ id: sim.id, title: '(레시피 없음)', header: [], verdict: '레시피 없음', detail: [] })
    continue
  }
  const headerLine = findCsvHeader(recipe.sketch)
  if (!headerLine) {
    reports.push({ id: sim.id, title: recipe.title, header: [], verdict: '헤더 없음', detail: [] })
    continue
  }
  const header = headerLine.split(',').map((name) => name.trim())
  const detail: string[] = []

  // 1회차만 붙여넣었을 때
  const first = convertSerialTextToCsv(buildSerialText(sim, header, 0))
  if (!first.ok) {
    reports.push({ id: sim.id, title: recipe.title, header, verdict: '❌ 파싱 실패', detail: [first.error] })
    continue
  }
  detail.push(`1회차 ${first.dataRowCount}행 · 제외 ${first.excludedRows.length}행`)

  const numeric = collectNumericColumns(first.header, first.rows)
  const numericNames = numeric.map((column) => column.name)
  const dropped = header.filter((name) => !numericNames.includes(name))
  if (dropped.length > 0) detail.push(`숫자 열로 인식되지 않음: ${dropped.join(', ')}`)
  detail.push(`기본 축: x=${numericNames[0] ?? '—'}, y=${numericNames[1] ?? '—'}`)

  // 한 행씩 센서를 바꿔 가며 출력하는 레시피는 한 계열 안에 여러 센서가 섞입니다.
  const groupColumn = header.find((name) => name === 'channel' || name === 'index' || name === 'position')
  let interleaved = false
  if (groupColumn) {
    const groupValues = readNamedColumn(first.header, first.rows, groupColumn)
    const groups = new Set(groupValues.filter((value): value is number => value !== null))
    const measured = numeric.find((column) => column.name !== groupColumn && !column.name.startsWith('time'))
    if (measured && groups.size > 1) {
      interleaved = true
      const values = measured.values.filter((value): value is number => value !== null)
      const stepMean = values.slice(1).reduce((total, value, index) => total + Math.abs(value - values[index]), 0) / (values.length - 1)
      const spread = Math.max(...values) - Math.min(...values)
      detail.push(
        `⚠ ${groupColumn} 열로 ${groups.size}개 센서를 한 행씩 번갈아 출력합니다. ${measured.name}을(를) 시간축에 그리면 이웃한 점끼리 평균 ${stepMean.toFixed(1)}씩 튀어(전체 범위 ${spread.toFixed(1)}) 한 계열 안에서 센서가 섞입니다. 탭에는 열 값으로 계열을 나누는 기능이 없습니다.`,
      )
    }
  }
  if (numeric.length < 2) detail.push('⚠ 숫자 열이 2개 미만이라 그래프를 그릴 수 없습니다.')
  if (numeric.length - 1 > MAX_SERIES) {
    detail.push(`⚠ 세로축 후보 ${numeric.length - 1}개 중 한 번에 ${MAX_SERIES}개까지만 그릴 수 있습니다.`)
  }

  // 조건을 회차로 나눠 넣었을 때
  if (sim.conditions.length >= 2) {
    const trials = sim.conditions.map((_condition, index) => {
      const parsed = convertSerialTextToCsv(buildSerialText(sim, header, index))
      if (!parsed.ok) throw new Error(`${sim.id} ${index}회차 파싱 실패`)
      return parsed
    })
    const desiredX = columnOf(sim.desired.x) ?? columnOf(sim.usable?.x ?? '') ?? numericNames[0]
    const desiredY = columnOf(sim.desired.y) ?? columnOf(sim.usable?.y ?? '') ?? numericNames[1]
    if (desiredX && desiredY && numericNames.includes(desiredX) && numericNames.includes(desiredY.split(' ')[0])) {
      const trialPoints = trials.map((trial) =>
        pairValues(
          readNamedColumn(trial.header, trial.rows, desiredX),
          readNamedColumn(trial.header, trial.rows, desiredY.split(' ')[0]),
        ),
      )
      const aggregate = aggregateByOrder(trialPoints)
      if (aggregate.worstSpreadRatio > MAX_TRUSTWORTHY_SPREAD_RATIO) {
        detail.push(
          `조건을 회차로 나누면 상자그림 보기에 "회차마다 가로축 값이 크게 다릅니다" 경고 (벌어짐 ${(aggregate.worstSpreadRatio * 100).toFixed(0)}%)`,
        )
      }
      const perTrial = trialPoints.map((points, index) => {
        const relation = summarizeRelation(points)
        return `${sim.conditions[index].label} 기울기 ${relation ? relation.slope.toPrecision(4) : '—'}`
      })
      detail.push(`회차별 기울기 표(${desiredX}→${desiredY.split(' ')[0]}): ${perTrial.join(' · ')}`)
    }

    // 조건을 한 번에 이어붙여 넣었을 때
    const joined = convertSerialTextToCsv(
      sim.conditions.map((_condition, index) => buildSerialText(sim, header, index)).join('\r\n'),
    )
    if (joined.ok) {
      detail.push(`조건 ${sim.conditions.length}개를 이어 붙이면 ${joined.dataRowCount}행 · 반복 헤더 ${joined.excludedRows.length}행 제외`)
    } else {
      detail.push(`⚠ 조건을 이어 붙이면 파싱 실패: ${joined.error}`)
    }
  }

  // 원하는 그래프를 그릴 수 있는가
  const xColumn = columnOf(sim.desired.x)
  const yColumn = columnOf(sim.desired.y)
  const xAvailable = xColumn !== null && numericNames.includes(xColumn)
  const yBase = yColumn?.split(' ')[0]
  const yAvailable = yBase !== undefined && numericNames.includes(yBase)

  let verdict: string
  if (xAvailable && yAvailable) {
    // 실제로 점을 찍어 관계를 확인
    const parsed = convertSerialTextToCsv(
      sim.conditions.length >= 2
        ? sim.conditions.map((_condition, index) => buildSerialText(sim, header, index)).join('\r\n')
        : buildSerialText(sim, header, 0),
    )
    if (parsed.ok) {
      const points = pairValues(
        readNamedColumn(parsed.header, parsed.rows, xColumn!),
        readNamedColumn(parsed.header, parsed.rows, yBase!),
      )
      const relation = summarizeRelation(points)
      detail.push(
        `원하는 축 ${xColumn} → ${yBase}: 점 ${points.length}개, 기울기 ${relation ? relation.slope.toPrecision(4) : '—'}, R² ${relation?.determination?.toFixed(4) ?? '—'}`,
      )
    }
    verdict = interleaved ? '△ 그려지지만 센서가 한 계열에 섞임' : '✅ 탭에서 바로 그려짐'
  } else if (interleaved) {
    verdict = '△ 그려지지만 센서가 한 계열에 섞임'
  } else if (sim.desired.x.startsWith('note:') || sim.desired.y.startsWith('note:')) {
    verdict = '❌ 축이 CSV에 없음(사람이 따로 적는 값)'
  } else {
    verdict = '❌ 축을 계산해야 함(탭에 계산 기능 없음)'
  }

  detail.push(`원하는 그래프: x=${sim.desired.x} / y=${sim.desired.y}`)
  if (sim.usable) detail.push(`탭에서 그릴 수 있는 중간 그래프: x=${sim.usable.x} / y=${sim.usable.y}`)

  reports.push({ id: sim.id, title: recipe.title, header, verdict, detail })
}

// ── 새 기능으로 원하는 그래프를 실제로 만들어 보기 ────────────────────────
interface AfterReport {
  id: string
  verdict: string
  detail: string[]
}

const afterReports: AfterReport[] = []

for (const sim of sims) {
  const recipe = recipeById.get(sim.id)
  const headerLine = recipe ? findCsvHeader(recipe.sketch) : null
  if (!recipe || !headerLine) continue
  const header = headerLine.split(',').map((name) => name.trim())

  const resolution = RESOLUTIONS[sim.id]
  if (!resolution) {
    afterReports.push({ id: sim.id, verdict: '❌ 해결 계획 없음', detail: [] })
    continue
  }

  const detail: string[] = []
  // 화면과 같은 차례로 다듬습니다: 구간 자르기 → 계열 펼치기 → 열 더하기.
  const built = sim.conditions.map((condition, index) => {
    const parsed = convertSerialTextToCsv(buildSerialText(sim, header, index))
    if (!parsed.ok) throw new Error(`${sim.id} ${index}회차 파싱 실패`)

    const cropped = resolution.crop
      ? cropRows(parsed.header, parsed.rows, {
          column: resolution.crop.column,
          min: resolution.crop.min ?? '',
          max: resolution.crop.max ?? '',
        })
      : parsed.rows
    const shaped = resolution.pivot && resolution.group
      ? pivotByColumn(parsed.header, cropped, resolution.group)
      : { header: parsed.header, rows: cropped }

    const manual = (resolution.manual ?? []).map((column) => ({
      name: column.name,
      value: column.value(condition.p, index),
    }))
    return buildColumns(shaped.header, shaped.rows, manual, resolution.calculated ?? [])
  })

  const failedExpressions = Object.entries(built[0].errors)
  if (failedExpressions.length > 0) {
    afterReports.push({
      id: sim.id,
      verdict: '❌ 식을 읽지 못함',
      detail: failedExpressions.map(([name, error]) => `${name}: ${error}`),
    })
    continue
  }

  const builtHeader = built[0].header
  const allRows = built.flatMap((trial) => trial.rows)
  const numeric = collectNumericColumns(builtHeader, allRows).map((column) => column.name)
  const added = builtHeader.filter((name) => !header.includes(name))
  if (added.length > 0) detail.push(`더한 열: ${added.join(', ')}`)

  if (!numeric.includes(resolution.x) || !numeric.includes(resolution.y)) {
    afterReports.push({
      id: sim.id,
      verdict: '❌ 축을 숫자 열로 만들지 못함',
      detail: [...detail, `x=${resolution.x}(${numeric.includes(resolution.x)}) y=${resolution.y}(${numeric.includes(resolution.y)})`],
    })
    continue
  }

  const seriesOf = () => {
    if (resolution.group && !resolution.pivot) {
      return splitRowsByColumn(builtHeader, allRows, resolution.group).map((group) => ({
        label: `${resolution.group} ${group.value}`,
        points: pairValues(
          readNamedColumn(builtHeader, group.rows, resolution.x),
          readNamedColumn(builtHeader, group.rows, resolution.y),
        ),
      }))
    }
    if (resolution.merged || sim.conditions.length === 1) {
      return [{
        label: '전체',
        points: pairValues(
          readNamedColumn(builtHeader, allRows, resolution.x),
          readNamedColumn(builtHeader, allRows, resolution.y),
        ),
      }]
    }
    return built.map((trial, index) => ({
      label: sim.conditions[index].label,
      points: pairValues(
        readNamedColumn(trial.header, trial.rows, resolution.x),
        readNamedColumn(trial.header, trial.rows, resolution.y),
      ),
    }))
  }

  const series = seriesOf().filter((entry) => entry.points.length > 0)
  if (series.length === 0) {
    afterReports.push({ id: sim.id, verdict: '❌ 점이 하나도 찍히지 않음', detail })
    continue
  }

  detail.push(
    `${resolution.group ? `${resolution.group}로 나눈 ` : resolution.merged ? '회차를 합친 ' : '회차별 '}계열 ${series.length}개 · 점 ${series.reduce((total, entry) => total + entry.points.length, 0)}개`,
  )
  for (const entry of series.slice(0, 4)) {
    const relation = summarizeRelation(entry.points)
    detail.push(
      `  ${entry.label}: 기울기 ${relation ? relation.slope.toPrecision(4) : '—'} · R² ${relation?.determination?.toFixed(4) ?? '—'}`,
    )
  }

  let verdict = resolution.remaining ? '✅ 그려짐(남은 한계 있음)' : '✅ 그려짐'
  if (resolution.expectSlope !== undefined) {
    const relation = summarizeRelation(series[0].points)
    const slope = relation?.slope ?? Number.NaN
    const error = Math.abs((slope - resolution.expectSlope) / resolution.expectSlope)
    detail.push(`  기대 기울기 ${resolution.expectSlope.toPrecision(4)} → 얻은 값 ${slope.toPrecision(4)} (차이 ${(error * 100).toFixed(1)}%)`)
    if (!(error < 0.1)) verdict = '❌ 기울기가 이론값과 다름'
  }
  if (resolution.remaining) detail.push(`  남은 한계: ${resolution.remaining}`)

  afterReports.push({ id: sim.id, verdict, detail })
}

// ── 출력 ──────────────────────────────────────────────────────────────────
for (const report of reports) {
  console.log(`\n==== ${report.id} | ${report.title}`)
  console.log(`  헤더: ${report.header.join(',')}`)
  console.log(`  판정: ${report.verdict}`)
  for (const line of report.detail) console.log(`   - ${line}`)
}

const missing = recipes.filter((recipe) => !sims.some((sim) => sim.id === recipe.id))
console.log(`\n\n==== 요약`)
console.log(`시뮬레이션한 레시피: ${sims.length} / 전체 ${recipes.length}`)
if (missing.length > 0) console.log(`빠진 레시피: ${missing.map((recipe) => recipe.id).join(', ')}`)
const counts = new Map<string, number>()
for (const report of reports) counts.set(report.verdict, (counts.get(report.verdict) ?? 0) + 1)
console.log('\n[열 더하기·나누기·합치기가 없던 때]')
for (const [verdict, count] of counts) console.log(`  ${verdict}: ${count}개`)

console.log('\n\n==== 새 기능으로 다시 만들어 본 결과')
for (const report of afterReports) {
  console.log(`\n---- ${report.id}: ${report.verdict}`)
  for (const line of report.detail) console.log(`   ${line}`)
}
const afterCounts = new Map<string, number>()
for (const report of afterReports) afterCounts.set(report.verdict, (afterCounts.get(report.verdict) ?? 0) + 1)
console.log('\n[열 더하기·나누기·합치기를 쓴 뒤]')
for (const [verdict, count] of afterCounts) console.log(`  ${verdict}: ${count}개`)
