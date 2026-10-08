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
 * Observed outcome per variant. `silent` and `chatter` are known weaknesses of
 * the published sketch, listed so they stay visible until the recipe is fixed.
 */
export const VARIANT_EXPECTATIONS: Readonly<Record<string, string>> = {}

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
