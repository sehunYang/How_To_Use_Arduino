/**
 * Real-world faults replayed against the student's unmodified sketch: the same
 * firmware as a recipe's behaviour project, run on a circuit or with a
 * stimulus that real hardware produces and the happy path never does.
 *
 * - unplugged:   one sensor's wires removed (a loose jumper, a dead module)
 * - i2c-address: a BME280 breakout strapped to 0x77 instead of 0x76
 * - jitter:      sensor noise straddling a control threshold
 *
 * Each variant's observed outcome is pinned in VARIANT_EXPECTATIONS, so a
 * sketch that starts failing silently, or a fix that makes one fail loudly,
 * shows up as a change.
 */

import type { Diagram } from './buildDiagram'
import { delayMs, set, type ScenarioStep } from './behaviorSpecHelpers'
import {
  chipsOf,
  fingerprintText,
  phase5ProjectFingerprint,
  type Phase5WokwiProject,
} from './phase5ProjectGenerator'
import { tsl2591Lux, TSL2591_GAIN, bme280HumidityRawFor } from './sensorOracles'

export type VariantKind = 'unplugged' | 'i2c-address' | 'jitter'

export interface WokwiVariant {
  /** `<recipe>--<kind>[-<part>]`, also the project directory name. */
  id: string
  recipeId: string
  /** The behaviour project whose firmware this variant reuses. */
  sourcePath: string
  kind: VariantKind
  description: string
  diagram: Diagram
  steps: ScenarioStep[]
  timeoutMs: number
  /** Classifies the serial output; the result is compared with VARIANT_EXPECTATIONS. */
  judge: (serial: string) => VariantVerdict
}

export interface VariantVerdict {
  outcome: string
  evidence: string
}

export const VARIANTS_ROOT = 'wokwi/variants'

/** Diagram part types that are sensors, with the values a sketch prints to flag them as missing. */
const SENSOR_PARTS: Readonly<Record<string, { sentinels: number[] }>> = {
  'wokwi-ds18b20': { sentinels: [-127] },
  'wokwi-mpu6050': { sentinels: [] },
  'wokwi-hc-sr04': { sentinels: [-1] },
  'chip-bme280': { sentinels: [] },
  'chip-ina219': { sentinels: [] },
  'chip-tsl2591': { sentinels: [] },
}

const NUMBER = /^-?\d+(\.\d+)?$/

function dataLines(serial: string, header: string): { before: string[]; rows: string[][] } | undefined {
  const lines = serial.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const headerIndex = lines.indexOf(header)
  if (headerIndex === -1) return undefined
  return {
    before: lines.slice(0, headerIndex),
    rows: lines.slice(headerIndex + 1).filter((line) => !line.startsWith('#')).map((line) => line.split(',')),
  }
}

/**
 * How a sketch behaves with a sensor missing:
 * - diagnosed: it says so (a `#` line, nan, or the sensor's documented sentinel)
 * - no-data:   it prints nothing a student could mistake for a measurement
 * - silent:    it prints plausible numbers, indistinguishable from real data
 */
function judgeMissingSensor(header: string, textColumns: readonly string[], sentinels: readonly number[], allowedComments: readonly string[]) {
  const columns = header.split(',')
  return (serial: string): VariantVerdict => {
    const comments = serial.split(/\r?\n/).map((line) => line.trim())
      .filter((line) => line.startsWith('#') && !allowedComments.includes(line))
    if (comments.length > 0) return { outcome: 'diagnosed', evidence: comments[0] }
    const parsed = dataLines(serial, header)
    if (!parsed) return { outcome: 'no-data', evidence: 'header never printed' }
    const rows = parsed.rows.filter((cells) => cells.length === columns.length)
    if (rows.length === 0) return { outcome: 'no-data', evidence: 'no complete rows' }
    for (const cells of rows) {
      for (const [index, cell] of cells.entries()) {
        if (textColumns.includes(columns[index])) continue
        if (!NUMBER.test(cell)) return { outcome: 'diagnosed', evidence: `${columns[index]}=${cell}` }
        if (sentinels.includes(Number(cell))) return { outcome: 'diagnosed', evidence: `${columns[index]}=${cell}` }
      }
    }
    return { outcome: 'silent', evidence: rows[rows.length - 1].join(',') }
  }
}

/** Steady if the state column changed at most once while the input jittered. */
function judgeChatter(header: string, stateColumn: string, skipRows: number) {
  const index = header.split(',').indexOf(stateColumn)
  return (serial: string): VariantVerdict => {
    const parsed = dataLines(serial, header)
    const states = parsed?.rows.filter((cells) => cells.length > index).map((cells) => cells[index]).slice(skipRows) ?? []
    if (states.length < 4) return { outcome: 'no-data', evidence: `${states.length} rows` }
    const changes = states.slice(1).filter((state, position) => state !== states[position]).length
    return {
      outcome: changes <= 1 ? 'steady' : 'chatter',
      evidence: `${stateColumn} changed ${changes} times over ${states.length} rows: ${states.join('')}`,
    }
  }
}

function withoutPart(diagram: Diagram, partId: string): Diagram {
  return {
    ...diagram,
    connections: diagram.connections.filter(([from, to]) => !from.startsWith(`${partId}:`) && !to.startsWith(`${partId}:`)),
  }
}

function withAttrs(diagram: Diagram, partId: string, attrs: Record<string, string>): Diagram {
  return {
    ...diagram,
    parts: diagram.parts.map((part) => (part.id === partId ? { ...part, attrs: { ...part.attrs, ...attrs } } : part)),
  }
}

/** Alternate a control between two values, one change every `periodMs`. */
function alternate(partId: string, control: string, values: [number, number], periodMs: number, count: number) {
  return Array.from({ length: count }, (_, index) => [set(partId, control, values[index % 2]), delayMs(periodMs)]).flat()
}

interface JitterCase {
  recipeId: string
  stateColumn: string
  description: string
  steps: ScenarioStep[]
  /** Rows printed while the scenario sets up the starting state, not counted. */
  skipRows?: number
}

/** Set the TSL2591 to a light with a fixed 1:4 infrared share. */
const light = (ch0: number): ScenarioStep[] => [set('tsl2591', 'ch0Raw', ch0), set('tsl2591', 'ch1Raw', Math.round(ch0 / 4))]
const luxAt = (ch0: number, gain: number) => tsl2591Lux(ch0, Math.round(ch0 / 4), gain).toFixed(0)

/** Noise straddling each controller's switching threshold, at roughly the sensor's real jitter. */
const JITTER_CASES: readonly JitterCase[] = [
  {
    recipeId: 'fan-control',
    stateColumn: 'fan',
    description: 'humidity flickering 69.5 ↔ 70.5 %RH around the 70 % switch-on point',
    steps: alternate('bme280', 'humidityRaw', [bme280HumidityRawFor(69.5), bme280HumidityRawFor(70.5)], 1000, 10),
  },
  {
    recipeId: 'd4-parking-barrier',
    stateColumn: 'door_state',
    description: 'car rocking 19 ↔ 21 cm around the 20 cm opening distance',
    steps: alternate('hc-sr04', 'distance', [19, 21], 120, 30),
  },
  {
    recipeId: 'd5-auto-curtain',
    stateColumn: 'commanded_deg',
    description: `light flickering ${luxAt(126, TSL2591_GAIN.medium)} ↔ ${luxAt(135, TSL2591_GAIN.medium)} lux around the 300 lux opening level`,
    // Dusk first, so the curtain starts closed; then the flicker.
    steps: [
      ...light(44), delayMs(3500),
      ...Array.from({ length: 10 }, (_, index) => [...light(index % 2 === 0 ? 135 : 126), delayMs(1150)]).flat(),
    ],
    skipRows: 3,
  },
  {
    recipeId: 'd6-temperature-alarm',
    stateColumn: 'alarm_state',
    description: 'probe reading 29.94 ↔ 30.06 °C around the 30 °C alarm point',
    steps: alternate('ds18b20', 'temperature', [29.9375, 30.0625], 1100, 10),
  },
  {
    recipeId: 'd8-elevator-floor',
    stateColumn: 'floor_index',
    description: 'car hovering 11 ↔ 12 cm, on the boundary between floors 1 and 2',
    steps: alternate('hc-sr04', 'distance', [11, 12], 350, 20),
  },
  {
    recipeId: 'photosynthesis-light-control',
    stateColumn: 'lamp',
    description: `light flickering ${luxAt(192, TSL2591_GAIN.low)} ↔ ${luxAt(200, TSL2591_GAIN.low)} lux around the 450 lux switch-on level`,
    steps: [delayMs(9000), ...Array.from({ length: 8 }, (_, index) => [...light(index % 2 === 0 ? 192 : 200), delayMs(1000)]).flat()],
  },
  {
    recipeId: 'rpm-meter',
    stateColumn: 'pulses',
    description: 'Hall output wobbling 0.43 ↔ 0.47 of full scale, between the 400/500 count thresholds',
    steps: [set('hbe0704', 'position', 1), delayMs(1500), ...alternate('hbe0704', 'position', [0.43, 0.47], 100, 40)],
  },
]

export function buildWokwiVariants(
  projects: readonly Phase5WokwiProject[],
  options: { allowedComments: (recipeId: string) => readonly string[] },
): WokwiVariant[] {
  const variants: WokwiVariant[] = []
  for (const project of projects) {
    const spec = project.behavior
    if (!spec) continue
    const textColumns = spec.textColumns ?? []
    const seen = new Set<string>()
    for (const part of project.diagram.parts) {
      const sensor = SENSOR_PARTS[part.type]
      // One unplugged case per sensor type; a second identical probe adds nothing.
      if (!sensor || seen.has(part.type)) continue
      seen.add(part.type)
      variants.push({
        id: `${project.id}--unplugged-${part.id}`,
        recipeId: project.id,
        sourcePath: project.path,
        kind: 'unplugged',
        description: `${part.id} disconnected`,
        diagram: withoutPart(project.diagram, part.id),
        steps: [delayMs(3000)],
        timeoutMs: 6000,
        judge: judgeMissingSensor(spec.header, textColumns, sensor.sentinels, options.allowedComments(project.id)),
      })
      if (part.type === 'chip-bme280') {
        variants.push({
          id: `${project.id}--bme280-at-0x77`,
          recipeId: project.id,
          sourcePath: project.path,
          kind: 'i2c-address',
          description: 'a BME280 breakout that answers at 0x77 (SDO high)',
          diagram: withAttrs(project.diagram, part.id, { address: '119' }),
          steps: [delayMs(3000)],
          timeoutMs: 6000,
          judge: judgeMissingSensor(spec.header, textColumns, sensor.sentinels, options.allowedComments(project.id)),
        })
      }
    }
  }
  for (const jitter of JITTER_CASES) {
    const project = projects.find((candidate) => candidate.id === jitter.recipeId)
    if (!project?.behavior) throw new Error(`jitter case for ${jitter.recipeId} needs its behaviour project`)
    variants.push({
      id: `${jitter.recipeId}--jitter`,
      recipeId: jitter.recipeId,
      sourcePath: project.path,
      kind: 'jitter',
      description: jitter.description,
      diagram: project.diagram,
      steps: jitter.steps,
      timeoutMs: 20_000,
      judge: judgeChatter(project.behavior.header, jitter.stateColumn, jitter.skipRows ?? 0),
    })
  }
  return variants
}

/**
 * Observed outcome per variant, recorded from the Wokwi Fault Variants run
 * 38198093875 (2026-10-12). `silent` and `chatter` are known weaknesses of the
 * published sketch, listed so they stay visible until the recipe is fixed;
 * fixing one means changing its entry here in the same change. The two b1
 * variants hit Wokwi service errors (1006 mid-run, HTTP 503) and are not yet
 * recorded. Entries marked `fixed:` were silent/chatter in that run and are
 * expected to change with the sensor checks added to the sketches; the next
 * variants run confirms them.
 */
export const VARIANT_EXPECTATIONS: Readonly<Record<string, string>> = {
  'S2--unplugged-hc-sr04': 'diagnosed', // # out-of-range
  'S5--unplugged-ds18b20': 'diagnosed', // # sensor-error
  'S6--unplugged-bme280': 'diagnosed', // # BME280_ERROR
  'S7--unplugged-ina219': 'diagnosed', // # INA219_ERROR
  'S8--unplugged-tsl2591': 'diagnosed', // # TSL2591_ERROR
  'a6-lcd-display--unplugged-ds18b20': 'diagnosed', // temperature_c=-127.00
  'b1-yeast-fermentation--unplugged-bme280': 'diagnosed', // # BME280_ERROR
  'b2-leaf-transpiration--unplugged-bme280': 'diagnosed', // # BME280_ERROR
  'b3-photosynthesis-pressure--unplugged-bme280': 'diagnosed', // # BME280_ERROR
  'b3-photosynthesis-pressure--unplugged-tsl2591': 'diagnosed', // # TSL2591_ERROR
  'b6-skin-temperature-recovery--unplugged-ds18b20': 'diagnosed', // skin_c=-127.00
  'b8-seed-germination-gdd--unplugged-ds18b20': 'diagnosed', // temperature_c=-127.00
  'c1-wet-dry-humidity--unplugged-bme280': 'diagnosed', // # BME280_ERROR
  'c1-wet-dry-humidity--unplugged-ds18b20_1': 'diagnosed', // wet_c=-127.00
  'c2-freezing-point-depression--unplugged-ds18b20': 'diagnosed', // temperature_c=-127.000
  'c3-turbidity-precipitation--unplugged-tsl2591': 'diagnosed', // # TSL2591_ERROR
  'c4-neutralization-endpoint--unplugged-ds18b20': 'diagnosed', // temperature_c=-127.000
  'c5-surface-albedo--unplugged-tsl2591': 'diagnosed', // # TSL2591_ERROR
  'c6-soil-water-heat-capacity--unplugged-ds18b20_1': 'diagnosed', // water_c=-127.00
  'c7-photobleaching--unplugged-tsl2591': 'diagnosed', // # TSL2591_ERROR
  'c8-ventilation-recovery--unplugged-bme280': 'diagnosed', // # BME280_ERROR
  'cooling-curve--unplugged-ds18b20': 'diagnosed', // temperature_c=nan
  'd4-parking-barrier--unplugged-hc-sr04': 'diagnosed', // distance_cm=-1
  'd5-auto-curtain--unplugged-tsl2591': 'diagnosed', // # TSL2591_ERROR
  'd6-temperature-alarm--unplugged-ds18b20': 'diagnosed', // temperature_c=-127.00
  'd8-elevator-floor--unplugged-hc-sr04': 'diagnosed', // distance_cm=-1
  'e1-terminal-velocity--unplugged-hc-sr04': 'diagnosed', // distance_cm=-1
  'e2-reaction-temperature--unplugged-ds18b20': 'diagnosed', // temperature_c=nan
  'e4-weather-pressure--unplugged-bme280': 'diagnosed', // # BME280_ERROR
  'fan-control--unplugged-bme280': 'diagnosed', // # BME280_ERROR
  'free-fall--unplugged-hc-sr04': 'diagnosed', // distance_m=-1.0000
  'obstacle-avoid-car--unplugged-hc-sr04': 'diagnosed', // distance_cm=nan
  'p4-friction-energy-loss--unplugged-hc-sr04': 'diagnosed', // distance_m=-1.0000
  'p7-solar-panel-angle--unplugged-tsl2591': 'diagnosed', // lux=nan
  'p8-inverse-square-light--unplugged-hc-sr04': 'diagnosed', // distance_m=-1.0000
  'p8-inverse-square-light--unplugged-tsl2591': 'diagnosed', // mean_lux=nan
  'parking-alarm--unplugged-hc-sr04': 'diagnosed', // distance_cm=nan
  'ph01-uniform-motion--unplugged-hc-sr04': 'diagnosed', // distance_m=-1.0000
  'ph05-restitution-coefficient--unplugged-hc-sr04': 'diagnosed', // distance_m=-1.0000
  'ph12-latent-heat--unplugged-ds18b20': 'diagnosed', // temperature_c=nan
  'ph14-insulation-performance--unplugged-bme280': 'diagnosed', // # BME280_ERROR
  'ph14-insulation-performance--unplugged-ds18b20': 'diagnosed', // object_temperature_c=nan
  'ph15-gas-temperature-pressure--unplugged-bme280': 'diagnosed', // # BME280_ERROR
  'ph16-altitude-pressure--unplugged-bme280': 'diagnosed', // # BME280_ERROR
  'ph34-torricelli-drain--unplugged-hc-sr04': 'diagnosed', // distance_m=-1.0000
  'ph35-temperature-speed-of-sound--unplugged-bme280': 'diagnosed', // # BME280_ERROR
  'photosynthesis-light-control--unplugged-tsl2591': 'diagnosed', // # TSL2591_ERROR
  'plant-growth--unplugged-bme280': 'diagnosed', // # BME280_ERROR
  'plant-growth--unplugged-tsl2591': 'diagnosed', // # TSL2591_ERROR
  'b4-reaction-time--unplugged-hc-sr04': 'no-data', // no complete rows
  'p9-motion-interrupt--unplugged-mpu6050': 'no-data', // no complete rows
  'S1--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'a1-led-brightness--unplugged-tsl2591': 'diagnosed', // fixed: # TSL2591_ERROR
  'b5-step-counter--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'b6-skin-temperature-recovery--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'd2-digital-level--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'd7-vibration-alarm--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'e2-pendulum-damping--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'e3-moment-of-inertia--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'e6-multi-point-temperature--unplugged-ds18b20_1': 'diagnosed', // fixed: # DS18B20_MISSING:found/expected
  'human-activity-meter--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'obstacle-avoid-car--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'p1-pendulum-period--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'p2-mechanical-energy--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'p4-friction-energy-loss--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'p5-incline-acceleration--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'p7-solar-panel-angle--unplugged-ina219': 'diagnosed', // fixed: # INA219_ERROR
  'ph02-newton-second-law--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'ph03-projectile-motion--unplugged-hc-sr04': 'diagnosed', // fixed: distance=-1
  'ph03-projectile-motion--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'ph04-momentum-collision--unplugged-mpu6050_1': 'diagnosed', // fixed: # MPU6050_0x68_ERROR
  'ph06-spring-oscillation--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'ph07-centripetal-acceleration--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'ph08-rpm-comparison--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'ph09-friction-coefficients--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'ph10-rotational-damping--unplugged-mpu6050': 'diagnosed', // fixed: # MPU6050_ERROR
  'ph11-specific-heat--unplugged-ds18b20_1': 'diagnosed', // fixed: # DS18B20_MISSING:found/expected
  'ph13-thermal-conductivity--unplugged-ds18b20_1': 'diagnosed', // fixed: # DS18B20_MISSING:found/expected
  'ph17-ohms-law--unplugged-ina219': 'diagnosed', // fixed: # INA219_ERROR
  'ph18-series-parallel-resistance--unplugged-ina219': 'diagnosed', // fixed: # INA219_ERROR
  'ph19-kirchhoff-laws--unplugged-ina219': 'diagnosed', // fixed: # INA219_ERROR
  'ph20-joule-heating--unplugged-ds18b20': 'diagnosed', // fixed: temperature_C=nan
  'ph20-joule-heating--unplugged-ina219': 'diagnosed', // fixed: # INA219_ERROR
  'ph21-rc-time-constant--unplugged-ina219': 'diagnosed', // fixed: # INA219_ERROR
  'ph22-battery-internal-resistance--unplugged-ina219': 'diagnosed', // fixed: # INA219_ERROR
  'ph23-solar-iv-mpp--unplugged-ina219': 'diagnosed', // fixed: # INA219_ERROR
  'ph23-solar-iv-mpp--unplugged-tsl2591': 'diagnosed', // fixed: # TSL2591_ERROR
  'ph24-solenoid-current-field--unplugged-ina219': 'diagnosed', // fixed: # INA219_ERROR
  'ph25-coil-turns-field--unplugged-ina219': 'diagnosed', // fixed: # INA219_ERROR
  'ph28-malus-law--unplugged-tsl2591': 'diagnosed', // fixed: # TSL2591_ERROR
  'ph29-transmittance-absorbance--unplugged-tsl2591': 'diagnosed', // fixed: # TSL2591_ERROR
  'ph30-reflection-intensity-angle--unplugged-tsl2591': 'diagnosed', // fixed: # TSL2591_ERROR
  'ph31-lens-focal-length--unplugged-tsl2591': 'diagnosed', // fixed: # TSL2591_ERROR
  'ph32-aperture-light--unplugged-tsl2591': 'diagnosed', // fixed: # TSL2591_ERROR
  'ph33-light-source-stability--unplugged-tsl2591': 'diagnosed', // fixed: # TSL2591_ERROR
  'ph35-temperature-speed-of-sound--unplugged-hc-sr04': 'diagnosed', // fixed: distance=-1
  's11-tsl2591-interrupt--unplugged-tsl2591': 'diagnosed', // fixed: # TSL2591_ERROR
  's12-dual-mpu6050-address--unplugged-mpu6050_1': 'diagnosed', // fixed: # MPU6050_0x68_ERROR
  'S6--bme280-at-0x77': 'diagnosed', // # BME280_ERROR
  'b2-leaf-transpiration--bme280-at-0x77': 'diagnosed', // # BME280_ERROR
  'b3-photosynthesis-pressure--bme280-at-0x77': 'diagnosed', // # BME280_ERROR
  'c1-wet-dry-humidity--bme280-at-0x77': 'diagnosed', // # BME280_ERROR
  'c8-ventilation-recovery--bme280-at-0x77': 'diagnosed', // # BME280_ERROR
  'e4-weather-pressure--bme280-at-0x77': 'diagnosed', // # BME280_ERROR
  'fan-control--bme280-at-0x77': 'diagnosed', // # BME280_ERROR
  'ph14-insulation-performance--bme280-at-0x77': 'diagnosed', // # BME280_ERROR
  'ph15-gas-temperature-pressure--bme280-at-0x77': 'diagnosed', // # BME280_ERROR
  'ph16-altitude-pressure--bme280-at-0x77': 'diagnosed', // # BME280_ERROR
  'ph35-temperature-speed-of-sound--bme280-at-0x77': 'diagnosed', // # BME280_ERROR
  'plant-growth--bme280-at-0x77': 'diagnosed', // # BME280_ERROR
  'd8-elevator-floor--jitter': 'steady', // fixed: floor changes only 0.65 floors past the current one
  'd4-parking-barrier--jitter': 'steady', // door_state changed 0 times over 36 rows: 11111111111111111111111111...
  'd5-auto-curtain--jitter': 'steady', // commanded_deg changed 1 times over 11 rows: 01201201201201201201201...
  'd6-temperature-alarm--jitter': 'steady', // alarm_state changed 1 times over 6 rows: 000111
  'fan-control--jitter': 'steady', // fan changed 1 times over 10 rows: 0111111111
  'photosynthesis-light-control--jitter': 'steady', // lamp changed 1 times over 16 rows: 0000000000111111
  'rpm-meter--jitter': 'steady', // pulses changed 0 times over 5 rows: 00000
}

export interface VariantManifestEntry {
  id: string
  recipeId: string
  kind: VariantKind
  path: string
  sourcePath: string
  timeoutMs: number
  scenario: string
  chips: string[]
  fingerprint: string
}

export function buildVariantManifest(
  variants: readonly WokwiVariant[],
  projects: readonly Phase5WokwiProject[],
): { version: 1; variantCount: number; variants: VariantManifestEntry[] } {
  const sourceFingerprint = new Map(projects.map((project) => [project.path, phase5ProjectFingerprint(project)]))
  return {
    version: 1,
    variantCount: variants.length,
    variants: variants.map((variant) => ({
      id: variant.id,
      recipeId: variant.recipeId,
      kind: variant.kind,
      path: `${VARIANTS_ROOT}/${variant.id}`,
      sourcePath: variant.sourcePath,
      timeoutMs: variant.timeoutMs,
      scenario: 'scenario.test.yaml',
      chips: chipsOf(variant.diagram),
      // The source sketch's fingerprint plus everything this variant changes.
      fingerprint: fingerprintText([
        sourceFingerprint.get(variant.sourcePath) ?? '',
        JSON.stringify({ diagram: variant.diagram, steps: variant.steps, timeoutMs: variant.timeoutMs }),
        variant.description,
        variant.judge.toString(),
      ].join('\u0000')),
    })),
  }
}
