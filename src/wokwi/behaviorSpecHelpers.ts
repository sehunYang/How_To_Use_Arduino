/**
 * Building blocks for behavioural Wokwi specs (see behaviorSpecs.ts): the spec
 * types, scenario step and expectation shorthands, and per-sensor helpers.
 */

import { tsl2591Lux } from './sensorOracles'

export type ScenarioStep =
  | { set: { partId: string; control: string; value: number } }
  | { waitSerial: string }
  | { delayMs: number }
  | { expectPin: { partId: string; pin: string; value: 0 | 1 } }

export interface ParsedRow {
  /** Raw cell text, for text columns such as `polarity`. */
  cells: Readonly<Record<string, string>>
  /** Numeric value of each cell (NaN for text columns). */
  values: Readonly<Record<string, number>>
}

export type CellExpectation =
  | { approx: number; tolerance: number }
  | { min: number; max: number }
  | { oneOf: number[]; tolerance: number }
  | { text: string }
  /** Physical relation computed from this row and every earlier row. */
  | { derived: (row: ParsedRow, previous: readonly ParsedRow[]) => number; tolerance: number }

export interface SampleInterval {
  min: number
  max: number
}

export interface BehaviorPhase {
  /** The physical situation, e.g. "warm water at 60 °C". */
  label: string
  /** Scenario steps that create this situation. */
  steps: ScenarioStep[]
  /** What every row printed during this situation must show. */
  expect: Record<string, CellExpectation>
  /** Rows taken while the stimulus was changing that may fit neither neighbour. */
  settleRows?: number
  /** Gap allowed after a row of this phase, when the sketch's own pace depends on it. */
  sampleInterval?: SampleInterval
}

export interface Phase5BehaviorSpec {
  recipeId: string
  /** The sketch's own CSV header; seeing it replaces the injected ready marker. */
  header: string
  phases: BehaviorPhase[]
  /** Steps after the last phase, e.g. a delay so it gets enough rows. */
  finalSteps?: ScenarioStep[]
  /** Expectations every row must meet regardless of phase. */
  always?: Record<string, CellExpectation>
  /** Column that carries the sketch's clock, checked against sampleInterval. */
  timeColumn?: string
  sampleInterval?: SampleInterval
  /** Non-numeric columns. */
  textColumns?: string[]
  /** `#` lines the sketch may print; any other diagnostic fails the run. */
  allowedComments?: string[]
  /** Rows printed before the first stimulus could take effect, exempt from phase matching. */
  startupRows?: number
  /** Minimum data rows the log must contain. */
  minRows: number
  /** Cross-row invariants the per-row expectations cannot express. */
  checkRows?: (rows: readonly ParsedRow[]) => string[]
  /** Simulated-time cap, when the registry default is not enough. */
  timeoutMs?: number
}



export const G = 9.80665
// MPU6050 at its power-on ±2 g range.
export const MPU_LSB_PER_G = 16384
// DS18B20 12-bit resolution.
export const DS18B20_LSB_C = 0.0625

export const set = (partId: string, control: string, value: number): ScenarioStep => ({ set: { partId, control, value } })
export const waitSerial = (text: string): ScenarioStep => ({ waitSerial: text })
export const delayMs = (ms: number): ScenarioStep => ({ delayMs: ms })
export const expectPin = (partId: string, pin: string, value: 0 | 1): ScenarioStep => ({
  expectPin: { partId, pin, value },
})
export const approx = (value: number, tolerance: number): CellExpectation => ({ approx: value, tolerance })
export const derived = (
  fn: (row: ParsedRow, previous: readonly ParsedRow[]) => number,
  tolerance: number,
): CellExpectation => ({ derived: fn, tolerance })

/** Acceleration the sketch reports for a simulated `g` reading, quantised as the ADC does. */
export const accelG = (g: number) => Math.round(g * MPU_LSB_PER_G) / MPU_LSB_PER_G
export const deg = (radians: number) => (radians * 180) / Math.PI

/**
 * Echo distance a correct sketch reports for an obstacle at `cm`: the echo is
 * the round trip at the speed of sound, so this is the distance itself. The
 * tolerance covers the 1 µs pulseIn resolution and the 343 vs 345 m/s spread
 * between the sketch's constant and the simulator's 58 µs/cm.
 */
export const echo = (cm: number, unit: 'cm' | 'm' = 'cm') => {
  const value = unit === 'cm' ? cm : cm / 100
  return approx(value, value * 0.02 + (unit === 'cm' ? 0.3 : 0.003))
}

/** 10-bit ADC reading for a potentiometer at `position` of 5 V. */
export const adc = (position: number) => approx(Math.min(1023, Math.round(position * 1023)), 3)

export function ds18b20Temperature(column: string, partId: string, values: number[], format: (t: number) => string) {
  return values.map<BehaviorPhase>((value, index) => ({
    label: `${partId} at ${value} °C`,
    steps: index === 0 ? [waitSerial(format(value))] : [set(partId, 'temperature', value), waitSerial(format(value))],
    expect: { [column]: approx(value, DS18B20_LSB_C) },
  }))
}

export interface BmeRaw { temperature: number; pressure: number; humidity: number }

/** Steps that move the BME280 chip from `from` to `to`, one control per changed reading. */
export function bmeSteps(partId: string, from: BmeRaw, to: BmeRaw): ScenarioStep[] {
  return (['temperature', 'pressure', 'humidity'] as const)
    .filter((quantity) => from[quantity] !== to[quantity])
    .map((quantity) => set(partId, `${quantity}Raw`, to[quantity]))
}

/** Lux expectation for raw light at `gain`, allowing float rounding in the sketch. */
export const lux = (ch0Raw: number, ch1Raw: number, gain: number) => {
  const value = tsl2591Lux(ch0Raw, ch1Raw, gain)
  return approx(value, Math.max(0.02, Math.abs(value) * 0.001))
}

/** Raw light that falls off with the inverse square of distance from a lamp. */
export const lampAt = (distanceM: number) => {
  const ch0 = Math.round(2000 * (0.5 / distanceM) ** 2)
  return { ch0, ch1: ch0 / 4 }
}
