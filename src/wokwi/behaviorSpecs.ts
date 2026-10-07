/**
 * Behavioural Wokwi specs: what a recipe's *unmodified* sketch must print when
 * the simulated sensors are driven through known physical situations.
 *
 * The expected values here are an oracle independent of the sketch: they come
 * from the stimulus we apply (the sensor's true value), the sensor's datasheet
 * conversion, and the physics the recipe claims to measure, never from
 * re-reading the sketch's arithmetic.
 */

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

import {
  barometricAltitudeM,
  BME280_DEFAULT_RAW,
  bme280HumidityPct,
  bme280HumidityRawFor,
  bme280PressureHpa,
  bme280TemperatureC,
  bme280TemperatureRawFor,
  ina219BusRegisterFor,
  ina219BusVolts,
  ina219CurrentMa,
  TSL2591_DEFAULT_RAW,
  TSL2591_GAIN,
  tsl2591Lux,
} from './sensorOracles'

const G = 9.80665
// MPU6050 at its power-on ±2 g range.
const MPU_LSB_PER_G = 16384
// DS18B20 12-bit resolution.
const DS18B20_LSB_C = 0.0625

const set = (partId: string, control: string, value: number): ScenarioStep => ({ set: { partId, control, value } })
const waitSerial = (text: string): ScenarioStep => ({ waitSerial: text })
const delayMs = (ms: number): ScenarioStep => ({ delayMs: ms })
const expectPin = (partId: string, pin: string, value: 0 | 1): ScenarioStep => ({
  expectPin: { partId, pin, value },
})
const approx = (value: number, tolerance: number): CellExpectation => ({ approx: value, tolerance })
const derived = (
  fn: (row: ParsedRow, previous: readonly ParsedRow[]) => number,
  tolerance: number,
): CellExpectation => ({ derived: fn, tolerance })

/** Acceleration the sketch reports for a simulated `g` reading, quantised as the ADC does. */
const accelG = (g: number) => Math.round(g * MPU_LSB_PER_G) / MPU_LSB_PER_G
const deg = (radians: number) => (radians * 180) / Math.PI

/**
 * Echo distance a correct sketch reports for an obstacle at `cm`: the echo is
 * the round trip at the speed of sound, so this is the distance itself. The
 * tolerance covers the 1 µs pulseIn resolution and the 343 vs 345 m/s spread
 * between the sketch's constant and the simulator's 58 µs/cm.
 */
const echo = (cm: number, unit: 'cm' | 'm' = 'cm') => {
  const value = unit === 'cm' ? cm : cm / 100
  return approx(value, value * 0.02 + (unit === 'cm' ? 0.3 : 0.003))
}

/** 10-bit ADC reading for a potentiometer at `position` of 5 V. */
const adc = (position: number) => approx(Math.min(1023, Math.round(position * 1023)), 3)

function ds18b20Temperature(column: string, partId: string, values: number[], format: (t: number) => string) {
  return values.map<BehaviorPhase>((value, index) => ({
    label: `${partId} at ${value} °C`,
    steps: index === 0 ? [waitSerial(format(value))] : [set(partId, 'temperature', value), waitSerial(format(value))],
    expect: { [column]: approx(value, DS18B20_LSB_C) },
  }))
}

interface BmeRaw { temperature: number; pressure: number; humidity: number }

/** Steps that move the BME280 chip from `from` to `to`, one control per changed reading. */
function bmeSteps(partId: string, from: BmeRaw, to: BmeRaw): ScenarioStep[] {
  return (['temperature', 'pressure', 'humidity'] as const)
    .filter((quantity) => from[quantity] !== to[quantity])
    .map((quantity) => set(partId, `${quantity}Raw`, to[quantity]))
}

/** Lux expectation for raw light at `gain`, allowing float rounding in the sketch. */
const lux = (ch0Raw: number, ch1Raw: number, gain: number) => {
  const value = tsl2591Lux(ch0Raw, ch1Raw, gain)
  return approx(value, Math.max(0.02, Math.abs(value) * 0.001))
}

/** Raw light that falls off with the inverse square of distance from a lamp. */
const lampAt = (distanceM: number) => {
  const ch0 = Math.round(2000 * (0.5 / distanceM) ** 2)
  return { ch0, ch1: ch0 / 4 }
}

// The cooling-curve recipe's @tunable default; students change it to their room temperature.
const COOLING_CURVE_AMBIENT_C = 22

export const phase5BehaviorSpecs: readonly Phase5BehaviorSpec[] = [
  // ── DS18B20 ──────────────────────────────────────────────────────────────
  {
    recipeId: 'cooling-curve',
    header: 'time_s,temperature_c,excess_temperature_c',
    // Warm water cooling toward the room: each step is a later point on the curve.
    phases: ds18b20Temperature('temperature_c', 'ds18b20', [22, 60, 45, 30, 22.5], (t) =>
      `,${t.toFixed(3)},${(t - COOLING_CURVE_AMBIENT_C).toFixed(3)}`),
    always: {
      excess_temperature_c: derived((row) => row.values.temperature_c - COOLING_CURVE_AMBIENT_C, 0.002),
    },
    timeColumn: 'time_s',
    // 750 ms conversion wait + 1000 ms delay + 9600-baud printing.
    sampleInterval: { min: 1.6, max: 2.0 },
    minRows: 5,
  },
  {
    recipeId: 'e2-reaction-temperature',
    header: 'time_s,temperature_c',
    // An exothermic reaction warming the solution.
    phases: ds18b20Temperature('temperature_c', 'ds18b20', [22, 35, 50], (t) => `,${t.toFixed(3)}`),
    timeColumn: 'time_s',
    sampleInterval: { min: 1.6, max: 2.0 },
    minRows: 3,
  },
  {
    recipeId: 'S5',
    header: 'time_ms,water_c',
    // Room-temperature, ice and hot water.
    phases: ds18b20Temperature('water_c', 'ds18b20', [22, 4, 80], (t) => `,${t.toFixed(2)}`),
    timeColumn: 'time_ms',
    // requestTemperatures() blocks up to 750 ms, then a 1000 ms delay.
    sampleInterval: { min: 1000, max: 1900 },
    minRows: 3,
  },
  {
    recipeId: 'e6-multi-point-temperature',
    header: 'time_ms,index,temperature_c',
    phases: [
      {
        label: 'three probes at room temperature',
        steps: [waitSerial(',2,22.000')],
        expect: { index: { oneOf: [0, 1, 2], tolerance: 0 }, temperature_c: approx(22, DS18B20_LSB_C) },
      },
      {
        label: 'probes at 30, 40 and 50 °C along the gradient',
        steps: [
          set('ds18b20_1', 'temperature', 30),
          set('ds18b20_2', 'temperature', 40),
          set('ds18b20_3', 'temperature', 50),
          delayMs(4000),
        ],
        expect: {
          index: { oneOf: [0, 1, 2], tolerance: 0 },
          temperature_c: { oneOf: [30, 40, 50], tolerance: DS18B20_LSB_C },
        },
        settleRows: 3,
      },
    ],
    // Every pass must find all three probes, in index order, each keeping its own reading.
    checkRows: (rows) => {
      const failures: string[] = []
      const indexes = rows.map((row) => row.values.index)
      indexes.forEach((index, position) => {
        if (index !== position % 3) failures.push(`row ${position + 1}: index ${index}, expected ${position % 3}`)
      })
      const last = rows.slice(-3).map((row) => row.values.temperature_c).sort((a, b) => a - b)
      if (JSON.stringify(last) !== JSON.stringify([30, 40, 50])) {
        failures.push(`last pass read ${last.join('/')} °C, expected one probe each at 30/40/50 °C`)
      }
      return failures
    },
    minRows: 9,
  },

  // ── MPU6050 ──────────────────────────────────────────────────────────────
  {
    recipeId: 'S1',
    header: 'time_ms,roll_deg,pitch_deg',
    phases: [
      {
        label: 'board lying flat',
        steps: [waitSerial(',0.0,0.0')],
        expect: { roll_deg: approx(0, 0.15), pitch_deg: approx(0, 0.15) },
      },
      {
        label: 'rolled 45° (gravity split between Y and Z)',
        steps: [set('mpu6050', 'accelY', 1), waitSerial(',45.0,0.0')],
        expect: { roll_deg: approx(45, 0.15), pitch_deg: approx(0, 0.15) },
      },
      {
        label: 'then pitched nose-up',
        steps: [set('mpu6050', 'accelX', -1), waitSerial(',45.0,35.3')],
        expect: { roll_deg: approx(45, 0.15), pitch_deg: approx(deg(Math.atan2(1, Math.SQRT2)), 0.15) },
      },
    ],
    finalSteps: [delayMs(300)],
    timeColumn: 'time_ms',
    sampleInterval: { min: 100, max: 110 },
    minRows: 5,
  },
  {
    recipeId: 'p1-pendulum-period',
    header: 'time_ms,ax_mps2',
    phases: [
      { label: 'pendulum at rest', steps: [waitSerial(',0.0000')], expect: { ax_mps2: approx(0, 0.002) } },
      {
        label: 'swinging out (+0.5 g)',
        steps: [set('mpu6050', 'accelX', 0.5), waitSerial(',4.9033')],
        expect: { ax_mps2: approx(0.5 * G, 0.002) },
      },
      {
        label: 'swinging back (-0.25 g)',
        steps: [set('mpu6050', 'accelX', -0.25), waitSerial(',-2.4517')],
        expect: { ax_mps2: approx(-0.25 * G, 0.002) },
      },
    ],
    finalSteps: [delayMs(300)],
    timeColumn: 'time_ms',
    sampleInterval: { min: 10, max: 11 },
    minRows: 10,
  },
  {
    recipeId: 'p2-mechanical-energy',
    header: 'time_ms,ax,ay,az,g_norm',
    phases: [
      {
        label: 'cart at rest',
        steps: [waitSerial(',0.0000,0.0000,1.0000,1.0000')],
        expect: { ax: approx(0, 0.0002), ay: approx(0, 0.0002), az: approx(1, 0.0002) },
      },
      {
        label: 'accelerating along X at 0.5 g',
        steps: [set('mpu6050', 'accelX', 0.5), waitSerial(',0.5000,0.0000,1.0000,1.1180')],
        expect: { ax: approx(0.5, 0.0002), ay: approx(0, 0.0002), az: approx(1, 0.0002) },
      },
      {
        label: 'on a dip where Z reads 0.5 g',
        steps: [set('mpu6050', 'accelZ', 0.5), waitSerial(',0.5000,0.0000,0.5000,0.7071')],
        expect: { ax: approx(0.5, 0.0002), ay: approx(0, 0.0002), az: approx(0.5, 0.0002) },
      },
    ],
    finalSteps: [delayMs(300)],
    always: {
      g_norm: derived(({ values: { ax, ay, az } }) => Math.hypot(ax, ay, az), 0.0002),
    },
    timeColumn: 'time_ms',
    sampleInterval: { min: 20, max: 21 },
    minRows: 10,
  },
  {
    recipeId: 'p5-incline-acceleration',
    header: 'time_ms,along_mps2,tilt_deg',
    phases: [
      {
        label: 'flat track',
        steps: [waitSerial(',0.0000,0.00')],
        expect: { along_mps2: approx(0, 0.002), tilt_deg: approx(0, 0.02) },
      },
      {
        label: 'gravity component 0.5 g along the track',
        steps: [set('mpu6050', 'accelX', 0.5), waitSerial(',4.9033,26.57')],
        expect: { along_mps2: approx(0.5 * G, 0.002), tilt_deg: approx(deg(Math.atan2(0.5, 1)), 0.02) },
      },
      {
        label: '30° incline (g sin30 along, g cos30 normal)',
        steps: [set('mpu6050', 'accelZ', 0.866), waitSerial(',4.9033,30.00')],
        expect: {
          along_mps2: approx(0.5 * G, 0.002),
          tilt_deg: approx(deg(Math.atan2(0.5, accelG(0.866))), 0.02),
        },
      },
    ],
    finalSteps: [delayMs(300)],
    timeColumn: 'time_ms',
    sampleInterval: { min: 20, max: 21 },
    minRows: 10,
  },
  {
    recipeId: 'human-activity-meter',
    header: 'time_ms,dynamic_g,active_fraction',
    phases: [
      {
        label: 'wearer sitting still',
        steps: [waitSerial(',0.0000,0.0000')],
        expect: { dynamic_g: approx(0, 0.0005) },
      },
      {
        label: 'jumping (1.5 g)',
        steps: [set('mpu6050', 'accelZ', 1.5), waitSerial(',0.5000,')],
        expect: { dynamic_g: approx(0.5, 0.0005) },
      },
      {
        label: 'walking gently (1.1 g, below the 0.18 g threshold)',
        steps: [set('mpu6050', 'accelZ', 1.1), waitSerial(',0.1000,')],
        expect: { dynamic_g: approx(accelG(1.1) - 1, 0.0005) },
      },
    ],
    finalSteps: [delayMs(500)],
    always: {
      // Share of all samples so far whose |a|-1g reached the recipe's 0.18 g threshold.
      active_fraction: derived((row, previous) => {
        const active = [...previous, row].filter((sample) => sample.values.dynamic_g >= 0.18).length
        return active / (previous.length + 1)
      }, 0.0001),
    },
    timeColumn: 'time_ms',
    sampleInterval: { min: 50, max: 54 },
    minRows: 10,
  },

  // ── HC-SR04 ──────────────────────────────────────────────────────────────
  {
    recipeId: 'S2',
    header: 'time_ms,distance_cm',
    phases: [
      { label: 'wall at 400 cm', steps: [delayMs(600)], expect: { distance_cm: echo(400) } },
      { label: 'wall at 100 cm', steps: [set('hc-sr04', 'distance', 100), delayMs(700)], expect: { distance_cm: echo(100) } },
      { label: 'hand at 25 cm', steps: [set('hc-sr04', 'distance', 25), delayMs(700)], expect: { distance_cm: echo(25) } },
    ],
    timeColumn: 'time_ms',
    sampleInterval: { min: 200, max: 230 },
    minRows: 6,
  },
  {
    recipeId: 'free-fall',
    header: 'time_ms,distance_m',
    phases: [
      { label: 'ball held 4 m above the sensor', steps: [delayMs(400)], expect: { distance_m: echo(400, 'm') } },
      { label: 'falling past 1.5 m', steps: [set('hc-sr04', 'distance', 150), delayMs(400)], expect: { distance_m: echo(150, 'm') } },
      { label: 'falling past 0.5 m', steps: [set('hc-sr04', 'distance', 50), delayMs(400)], expect: { distance_m: echo(50, 'm') } },
    ],
    timeColumn: 'time_ms',
    sampleInterval: { min: 60, max: 62 },
    minRows: 12,
  },
  {
    recipeId: 'parking-alarm',
    header: 'time_ms,distance_cm',
    phases: [
      {
        label: 'open road (400 cm): LED off',
        steps: [delayMs(1200), expectPin('uno', '4', 0)],
        expect: { distance_cm: echo(400) },
        sampleInterval: { min: 500, max: 535 },
      },
      {
        label: 'wall at 30 cm: LED on, faster beeps',
        steps: [set('hc-sr04', 'distance', 30), delayMs(1000), expectPin('uno', '4', 1)],
        expect: { distance_cm: echo(30) },
        // delay = 8 ms per cm below the 60 cm warning distance.
        sampleInterval: { min: 238, max: 260 },
      },
      {
        label: 'backed off to 100 cm: LED off',
        steps: [set('hc-sr04', 'distance', 100), delayMs(1200), expectPin('uno', '4', 0)],
        expect: { distance_cm: echo(100) },
        sampleInterval: { min: 500, max: 535 },
      },
    ],
    timeColumn: 'time_ms',
    minRows: 8,
  },
  {
    recipeId: 'p4-friction-energy-loss',
    header: 'time_ms,distance_m,ax_mps2',
    phases: [
      {
        label: 'cart 4 m from the sensor, at rest',
        steps: [delayMs(400)],
        expect: { distance_m: echo(400, 'm'), ax_mps2: approx(0, 0.002) },
      },
      {
        label: 'cart at 1 m',
        steps: [set('hc-sr04', 'distance', 100), delayMs(400)],
        expect: { distance_m: echo(100, 'm'), ax_mps2: approx(0, 0.002) },
      },
      {
        label: 'friction decelerating it at 0.25 g',
        steps: [set('mpu6050', 'accelX', -0.25), delayMs(400)],
        expect: { distance_m: echo(100, 'm'), ax_mps2: approx(-0.25 * G, 0.002) },
      },
    ],
    timeColumn: 'time_ms',
    sampleInterval: { min: 60, max: 62 },
    minRows: 12,
  },
  {
    recipeId: 'obstacle-avoid-car',
    header: 'time_ms,distance_cm,tilt_x_g',
    phases: [
      {
        label: 'clear road ahead',
        steps: [delayMs(800)],
        expect: { distance_cm: echo(400), tilt_x_g: approx(0, 0.002) },
      },
      {
        label: 'obstacle at 20 cm: left wheel stops to turn',
        steps: [set('hc-sr04', 'distance', 20), delayMs(1000), expectPin('uno', '5', 0)],
        expect: { distance_cm: echo(20), tilt_x_g: approx(0, 0.002) },
      },
      {
        label: 'nose tilted by 0.25 g while turning',
        steps: [set('mpu6050', 'accelX', 0.25), delayMs(500)],
        expect: { distance_cm: echo(20), tilt_x_g: approx(0.25, 0.002) },
      },
    ],
    timeColumn: 'time_ms',
    minRows: 10,
  },

  // ── Hall sensor (potentiometer stand-in) ─────────────────────────────────
  {
    recipeId: 'S10',
    header: 'raw,polarity,relative_strength',
    textColumns: ['polarity'],
    phases: [
      {
        label: 'south pole pressed to the sensor (0 V)',
        steps: [delayMs(300)],
        expect: { raw: adc(0), polarity: { text: 'negative' } },
      },
      {
        label: 'north pole pressed to the sensor (5 V)',
        steps: [set('hbe0704', 'position', 1), delayMs(300)],
        expect: { raw: adc(1), polarity: { text: 'positive' } },
      },
      {
        label: 'north pole farther away (3.75 V)',
        steps: [set('hbe0704', 'position', 0.75), delayMs(300)],
        expect: { raw: adc(0.75), polarity: { text: 'positive' } },
      },
    ],
    always: { relative_strength: derived(({ values }) => Math.abs(values.raw - 512), 0) },
    minRows: 6,
  },
  {
    recipeId: 'p6-magnetic-field-distance',
    header: 'time_ms,raw,signed_relative_field',
    phases: [
      { label: 'magnet touching, south pole', steps: [delayMs(300)], expect: { raw: adc(0) } },
      { label: 'magnet moved away', steps: [set('hbe0704', 'position', 0.25), delayMs(300)], expect: { raw: adc(0.25) } },
      { label: 'magnet flipped, north pole', steps: [set('hbe0704', 'position', 1), delayMs(300)], expect: { raw: adc(1) } },
    ],
    always: { signed_relative_field: derived(({ values }) => values.raw - 512, 0) },
    timeColumn: 'time_ms',
    sampleInterval: { min: 50, max: 55 },
    minRows: 9,
  },
  {
    recipeId: 'rpm-meter',
    header: 'time_ms,pulses,rpm',
    phases: [
      {
        // The potentiometer powers up at 0 V, i.e. a magnet already at the sensor;
        // the first window counts it once (see checkRows), then the wheel rests.
        label: 'wheel at rest',
        steps: [delayMs(1500), set('hbe0704', 'position', 1), delayMs(1500)],
        expect: { pulses: { min: 0, max: 1 } },
      },
      {
        label: 'wheel spinning at 5 rev/s (300 rpm)',
        // One magnet pass every 200 ms for 4 s.
        steps: Array.from({ length: 20 }, () => [
          set('hbe0704', 'position', 0),
          delayMs(100),
          set('hbe0704', 'position', 1),
          delayMs(100),
        ]).flat(),
        expect: { pulses: { min: 4, max: 6 } },
        settleRows: 1,
      },
      { label: 'wheel stopped', steps: [delayMs(2500)], expect: { pulses: approx(0, 0) }, settleRows: 1 },
    ],
    // rpm = passes per window × 60 s / window length (1 s), one magnet per revolution.
    always: { rpm: derived(({ values }) => values.pulses * 60, 1) },
    checkRows: (rows) => {
      const counts = rows.map((row) => row.values.pulses)
      const failures: string[] = []
      if (counts[0] !== 1) failures.push(`first window counted ${counts[0]} passes, expected the parked magnet once`)
      if (counts.slice(1, 3).some((count) => count !== 0)) failures.push('a still wheel was counted as turning')
      if (counts.filter((count) => count >= 4).length < 2) failures.push('fewer than two full windows at 300 rpm')
      return failures
    },
    timeColumn: 'time_ms',
    sampleInterval: { min: 1000, max: 1002 },
    minRows: 7,
  },
  // ── BME280 / INA219 / TSL2591 custom chips ───────────────────────────────
  (() => {
    const states: Array<{ label: string; raw: BmeRaw }> = [
      { label: 'room air', raw: { ...BME280_DEFAULT_RAW } },
      { label: 'warmed to 31 °C', raw: { ...BME280_DEFAULT_RAW, temperature: bme280TemperatureRawFor(31) } },
      {
        label: 'humid air (75 %RH at 31 °C)',
        raw: {
          ...BME280_DEFAULT_RAW,
          temperature: bme280TemperatureRawFor(31),
          humidity: bme280HumidityRawFor(75, bme280TemperatureRawFor(31)),
        },
      },
      {
        label: 'a low-pressure front',
        raw: {
          temperature: bme280TemperatureRawFor(31),
          humidity: bme280HumidityRawFor(75, bme280TemperatureRawFor(31)),
          pressure: 440000,
        },
      },
    ]
    return {
      recipeId: 'S6',
      header: 'time_ms,temperature_c,humidity_pct,pressure_hpa',
      phases: states.map(({ label, raw }, index) => ({
        label,
        steps: [...(index === 0 ? [] : bmeSteps('bme280', states[index - 1].raw, raw)), delayMs(2500)],
        expect: {
          temperature_c: approx(bme280TemperatureC(raw.temperature), 0.015),
          humidity_pct: approx(bme280HumidityPct(raw.humidity, raw.temperature), 0.15),
          pressure_hpa: approx(bme280PressureHpa(raw.pressure, raw.temperature), 0.05),
        },
      })),
      timeColumn: 'time_ms',
      sampleInterval: { min: 1000, max: 1060 },
      minRows: 8,
    } satisfies Phase5BehaviorSpec
  })(),
  {
    recipeId: 'e4-weather-pressure',
    header: 'time_min,pressure_hpa,relative_altitude_m',
    // The recipe logs once a minute, so one reading fits in the run.
    phases: [
      {
        label: 'today\'s air pressure',
        steps: [waitSerial(',1006.53,')],
        expect: {
          pressure_hpa: approx(bme280PressureHpa(BME280_DEFAULT_RAW.pressure, BME280_DEFAULT_RAW.temperature), 0.05),
        },
      },
    ],
    always: {
      // The default sea-level reference is the standard atmosphere's 1013.25 hPa.
      relative_altitude_m: derived(({ values }) => barometricAltitudeM(values.pressure_hpa, 1013.25), 0.1),
    },
    // The wait matches mid-row; let the altitude cell finish printing.
    finalSteps: [delayMs(500)],
    minRows: 1,
  },
  (() => {
    const t25 = BME280_DEFAULT_RAW.temperature
    const t31 = bme280TemperatureRawFor(31)
    const at = (temperature: number, humidityPct: number): BmeRaw => ({
      ...BME280_DEFAULT_RAW,
      temperature,
      humidity: bme280HumidityRawFor(humidityPct, temperature),
    })
    // On at >=70 %RH or >=30 °C, off only once <=65 %RH and <30 °C (the recipe's stated rule).
    const states: Array<{ label: string; raw: BmeRaw; fan: 0 | 1 }> = [
      { label: 'bathroom at rest', raw: { ...BME280_DEFAULT_RAW }, fan: 0 },
      { label: 'shower running: 75 %RH turns the fan on', raw: at(t25, 75), fan: 1 },
      { label: 'drying: 67 %RH is inside the hysteresis band, fan stays on', raw: at(t25, 67), fan: 1 },
      { label: 'dry: 60 %RH turns it off', raw: at(t25, 60), fan: 0 },
      { label: 'hot day: 31 °C turns it on regardless of humidity', raw: { ...at(t25, 60), temperature: t31 }, fan: 1 },
    ]
    return {
      recipeId: 'fan-control',
      header: 'time_s,temperature_c,humidity_percent,fan',
      phases: states.map(({ label, raw, fan }, index) => ({
        label,
        steps: [
          ...(index === 0 ? [] : bmeSteps('bme280', states[index - 1].raw, raw)),
          delayMs(2500),
          expectPin('uno', '7', fan),
        ],
        expect: {
          temperature_c: approx(bme280TemperatureC(raw.temperature), 0.015),
          humidity_percent: approx(bme280HumidityPct(raw.humidity, raw.temperature), 0.1),
          fan: approx(fan, 0),
        },
      })),
      timeColumn: 'time_s',
      sampleInterval: { min: 0.95, max: 1.15 },
      minRows: 10,
    } satisfies Phase5BehaviorSpec
  })(),
  (() => {
    const t = BME280_DEFAULT_RAW.temperature
    const brighter = { ch0: TSL2591_DEFAULT_RAW.ch0 * 2, ch1: TSL2591_DEFAULT_RAW.ch1 * 2 }
    const drier = bme280HumidityRawFor(60)
    return {
      recipeId: 'plant-growth',
      header: 'time_ms,lux,temperature_c,humidity_pct',
      phases: [
        {
          label: 'window light, room air',
          steps: [delayMs(6000)],
          expect: {
            lux: lux(TSL2591_DEFAULT_RAW.ch0, TSL2591_DEFAULT_RAW.ch1, TSL2591_GAIN.low),
            temperature_c: approx(bme280TemperatureC(t), 0.015),
            humidity_pct: approx(bme280HumidityPct(BME280_DEFAULT_RAW.humidity, t), 0.15),
          },
        },
        {
          label: 'grow lamp doubles the light, air dries to 60 %RH',
          steps: [
            set('tsl2591', 'ch0Raw', brighter.ch0),
            set('tsl2591', 'ch1Raw', brighter.ch1),
            set('bme280', 'humidityRaw', drier),
            delayMs(10000),
          ],
          expect: {
            lux: lux(brighter.ch0, brighter.ch1, TSL2591_GAIN.low),
            temperature_c: approx(bme280TemperatureC(t), 0.015),
            humidity_pct: approx(bme280HumidityPct(drier, t), 0.15),
          },
        },
      ],
      timeColumn: 'time_ms',
      // 5 s logging interval + 120 ms TSL2591 integration.
      sampleInterval: { min: 5100, max: 5200 },
      minRows: 4,
    } satisfies Phase5BehaviorSpec
  })(),
  (() => {
    const states = [
      { label: 'USB load at 2.5 V', shunt: 100, bus: 5000 },
      { label: 'LED strip switched on (250 mA)', shunt: 2500, bus: 5000 },
      { label: 'supply raised to 5 V', shunt: 2500, bus: ina219BusRegisterFor(5) },
    ]
    return {
      recipeId: 'S7',
      header: 'time_ms,voltage_v,current_ma,power_mw',
      phases: states.map(({ label, shunt, bus }, index) => ({
        label,
        steps: [
          ...(index > 0 && shunt !== states[index - 1].shunt ? [set('ina219', 'shuntRaw', shunt)] : []),
          ...(index > 0 && bus !== states[index - 1].bus ? [set('ina219', 'busRaw', bus)] : []),
          delayMs(1200),
        ],
        expect: { voltage_v: approx(ina219BusVolts(bus), 0.002), current_ma: approx(ina219CurrentMa(shunt), 0.01) },
      })),
      // P = V × I
      always: { power_mw: derived(({ values }) => values.voltage_v * values.current_ma, 0.02) },
      timeColumn: 'time_ms',
      sampleInterval: { min: 500, max: 520 },
      minRows: 6,
    } satisfies Phase5BehaviorSpec
  })(),
  {
    recipeId: 'S8',
    header: 'time_ms,lux',
    phases: [
      {
        label: 'indoor light',
        steps: [delayMs(1500)],
        expect: { lux: lux(TSL2591_DEFAULT_RAW.ch0, TSL2591_DEFAULT_RAW.ch1, TSL2591_GAIN.medium) },
      },
      {
        label: 'twice the light',
        steps: [
          set('tsl2591', 'ch0Raw', TSL2591_DEFAULT_RAW.ch0 * 2),
          set('tsl2591', 'ch1Raw', TSL2591_DEFAULT_RAW.ch1 * 2),
          delayMs(1500),
        ],
        expect: { lux: lux(TSL2591_DEFAULT_RAW.ch0 * 2, TSL2591_DEFAULT_RAW.ch1 * 2, TSL2591_GAIN.medium) },
        settleRows: 1,
      },
      {
        // The recipe tells students that -1 means the medium gain is saturated.
        label: 'direct sun saturates the medium gain',
        steps: [set('tsl2591', 'ch0Raw', 3000), set('tsl2591', 'ch1Raw', 780), delayMs(1500)],
        expect: { lux: approx(tsl2591Lux(3000, 780, TSL2591_GAIN.medium), 0) },
        settleRows: 1,
      },
    ],
    timeColumn: 'time_ms',
    // 500 ms delay + 120 ms integration.
    sampleInterval: { min: 610, max: 680 },
    minRows: 6,
  },
  (() => {
    // Irradiance on a tilted panel falls with cos(angle); so do its current and the light it sees.
    const facing = { ch0: 4000, ch1: 1000, shunt: 1000 }
    const tilted = { ch0: 2000, ch1: 500, shunt: 500 }
    const bus = ina219BusRegisterFor(2)
    return {
      recipeId: 'p7-solar-panel-angle',
      header: 'time_ms,voltage_v,current_ma,power_mw,lux,power_density_mw_cm2',
      startupRows: 1,
      phases: [
        {
          label: 'panel facing the lamp (0°)',
          steps: [
            set('tsl2591', 'ch0Raw', facing.ch0),
            set('tsl2591', 'ch1Raw', facing.ch1),
            set('ina219', 'shuntRaw', facing.shunt),
            set('ina219', 'busRaw', bus),
            delayMs(1500),
          ],
          expect: {
            voltage_v: approx(ina219BusVolts(bus), 0.002),
            current_ma: approx(ina219CurrentMa(facing.shunt), 0.01),
            lux: lux(facing.ch0, facing.ch1, TSL2591_GAIN.low),
          },
        },
        {
          label: 'panel tilted 60° (cos 60° = 0.5)',
          steps: [
            set('tsl2591', 'ch0Raw', tilted.ch0),
            set('tsl2591', 'ch1Raw', tilted.ch1),
            set('ina219', 'shuntRaw', tilted.shunt),
            delayMs(1500),
          ],
          expect: {
            voltage_v: approx(ina219BusVolts(bus), 0.002),
            current_ma: approx(ina219CurrentMa(tilted.shunt), 0.01),
            lux: lux(tilted.ch0, tilted.ch1, TSL2591_GAIN.low),
          },
          settleRows: 1,
        },
      ],
      always: {
        // The power register has a 2 mW LSB and truncates.
        power_mw: derived(({ values }) => values.voltage_v * values.current_ma, 2.1),
        power_density_mw_cm2: derived(({ values }) => values.power_mw / 100, 0.0001),
      },
      timeColumn: 'time_ms',
      // 250 ms delay + 120 ms integration.
      sampleInterval: { min: 370, max: 410 },
      minRows: 6,
    } satisfies Phase5BehaviorSpec
  })(),
  (() => {
    const phase = (distanceM: number, first: boolean): BehaviorPhase => {
      const light = lampAt(distanceM)
      const lux0 = tsl2591Lux(light.ch0, light.ch1, TSL2591_GAIN.low)
      return {
        label: `lamp ${distanceM} m away`,
        steps: [
          set('hc-sr04', 'distance', distanceM * 100),
          set('tsl2591', 'ch0Raw', light.ch0),
          set('tsl2591', 'ch1Raw', light.ch1),
          delayMs(3500),
        ],
        expect: {
          distance_m: echo(distanceM * 100, 'm'),
          mean_lux: lux(light.ch0, light.ch1, TSL2591_GAIN.low),
          // Inverse-square law: d² × E stays the lamp's constant at every distance.
          d2_times_lux: approx(lux0 * distanceM ** 2, lux0 * distanceM ** 2 * 0.06),
        },
        ...(first ? {} : { settleRows: 1 }),
      }
    }
    return {
      recipeId: 'p8-inverse-square-light',
      header: 'time_ms,distance_m,mean_lux,d2_times_lux',
      startupRows: 1,
      phases: [phase(0.5, true), phase(1, false), phase(0.25, false)],
      always: {
        // The sketch multiplies by the unrounded distance; printing it to 0.1 mm moves d² × E by up to ~2.
        d2_times_lux: derived(({ values }) => values.mean_lux * values.distance_m ** 2, 2),
      },
      minRows: 6,
    } satisfies Phase5BehaviorSpec
  })(),
  {
    recipeId: 'photosynthesis-light-control',
    header: 'time_ms,lux,lamp',
    phases: [
      {
        label: 'sunlit bench, lamp off',
        steps: [delayMs(4000)],
        expect: { lux: lux(TSL2591_DEFAULT_RAW.ch0, TSL2591_DEFAULT_RAW.ch1, TSL2591_GAIN.low), lamp: approx(0, 0) },
      },
      {
        label: 'clouds at 4 s: dark, but the 10 s minimum hold keeps the lamp off',
        steps: [set('tsl2591', 'ch0Raw', 50), set('tsl2591', 'ch1Raw', 12), delayMs(5000), expectPin('uno', '7', 0)],
        expect: { lux: lux(50, 12, TSL2591_GAIN.low), lamp: approx(0, 0) },
      },
      {
        label: 'hold expired: lamp switches on',
        steps: [delayMs(3000), expectPin('uno', '7', 1)],
        expect: { lux: lux(50, 12, TSL2591_GAIN.low), lamp: approx(1, 0) },
      },
    ],
    timeColumn: 'time_ms',
    // 1 s delay + 120 ms integration.
    sampleInterval: { min: 1100, max: 1170 },
    minRows: 10,
  },
]

export const phase5BehaviorSpecById: ReadonlyMap<string, Phase5BehaviorSpec> = new Map(
  phase5BehaviorSpecs.map((spec) => [spec.recipeId, spec]),
)
