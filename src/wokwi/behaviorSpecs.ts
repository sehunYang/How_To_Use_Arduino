/**
 * Behavioural Wokwi specs: what a recipe's *unmodified* sketch must print when
 * the simulated sensor is driven through known physical values.
 *
 * The expected values here are an oracle independent of the sketch: they come
 * from the stimulus we apply (the sensor's true value) and the physics the
 * recipe claims to measure, never from re-reading the sketch's arithmetic.
 */

export interface BehaviorStimulus {
  /** Wokwi part id in the generated diagram. */
  partId: string
  /** Wokwi automation control name for that part. */
  control: string
  value: number
  /** Substring the sketch must print once the sensor reports `value`. */
  expectSerial: string
}

export interface BehaviorDerivedColumn {
  column: string
  /** Independent physical expectation computed from the row's other columns. */
  expected: (row: Readonly<Record<string, number>>) => number
  tolerance: number
}

export interface BehaviorStepColumn {
  /** Column that reports the stimulated physical quantity. */
  column: string
  /** Sensor value before the first stimulus (the part's diagram default). */
  initial: number
  /** Allowed deviation, e.g. one LSB of the sensor's resolution. */
  tolerance: number
}

export interface Phase5BehaviorSpec {
  recipeId: string
  /** The sketch's own CSV header; seeing it replaces the injected ready marker. */
  header: string
  /** Serial line expected before any stimulus, proving the sensor's default reading. */
  baselineSerial: string
  stimuli: BehaviorStimulus[]
  /** Column that must strictly increase row to row (the sketch's clock). */
  timeColumn: string
  /** Allowed gap between consecutive rows, in the time column's unit. */
  sampleInterval: { min: number; max: number }
  stepColumn: BehaviorStepColumn
  derived: BehaviorDerivedColumn[]
  /** Minimum data rows the log must contain. */
  minRows: number
}

// DS18B20 12-bit resolution is 1/16 °C; every stimulus below is a multiple of it.
const DS18B20_LSB_C = 0.0625
// The recipe's @tunable default; students change it to their measured room temperature.
const COOLING_CURVE_AMBIENT_C = 22

export const phase5BehaviorSpecs: readonly Phase5BehaviorSpec[] = [
  {
    recipeId: 'cooling-curve',
    header: 'time_s,temperature_c,excess_temperature_c',
    baselineSerial: ',22.000,0.000',
    // Warm water cooling toward the room: each step is a later point on the curve.
    stimuli: [
      { partId: 'ds18b20', control: 'temperature', value: 60, expectSerial: ',60.000,38.000' },
      { partId: 'ds18b20', control: 'temperature', value: 45, expectSerial: ',45.000,23.000' },
      { partId: 'ds18b20', control: 'temperature', value: 30, expectSerial: ',30.000,8.000' },
      { partId: 'ds18b20', control: 'temperature', value: 22.5, expectSerial: ',22.500,0.500' },
    ],
    timeColumn: 'time_s',
    // 750 ms conversion wait + 1000 ms delay + 9600-baud printing.
    sampleInterval: { min: 1.6, max: 2.0 },
    stepColumn: { column: 'temperature_c', initial: 22, tolerance: DS18B20_LSB_C },
    derived: [
      {
        column: 'excess_temperature_c',
        expected: (row) => row.temperature_c - COOLING_CURVE_AMBIENT_C,
        tolerance: 0.002,
      },
    ],
    minRows: 5,
  },
]

export const phase5BehaviorSpecById: ReadonlyMap<string, Phase5BehaviorSpec> = new Map(
  phase5BehaviorSpecs.map((spec) => [spec.recipeId, spec]),
)
