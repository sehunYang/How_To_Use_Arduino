/**
 * What the PIR recipes' sketches must do over minutes of simulated time
 * (see sketchHost.ts). Inputs come from the HC-SR501's datasheet behaviour and
 * the scene each recipe describes; expectations from what the recipe promises
 * the student, never from re-reading the sketch.
 */

import type { ParsedRow, Phase5BehaviorSpec } from '@/wokwi/behaviorSpecHelpers'
import {
  type SketchHostSpec,
  type TraceEdge,
  type Window,
  followsWindows,
  levelInputs,
  pirOutput,
  pulses,
  reactsWithin,
  within,
} from './sketchHost'

const PIR = 'D2'
// Someone crossing the room while the PIR warms up: every sketch must ignore it.
const WARM_UP_CROSSING: Window = [5000, 8000]
const WARM_UP_MS = 30000

/** One phase that accepts every row, for runs judged by `always` and `checkRows`. */
const wholeRun = (expect: Phase5BehaviorSpec['phases'][number]['expect'] = {}) => [{ label: 'whole run', steps: [], expect }]

const startsAfterWarmUp = (rows: readonly ParsedRow[]) =>
  rows[0] && rows[0].values.time_ms < WARM_UP_MS ? [`first row at ${rows[0].values.time_ms} ms, inside the 30 s PIR warm-up`] : []

/** Value of a stepwise input at `ms`: the last step at or before it. */
const stepAt = (steps: ReadonlyArray<readonly [number, number]>, ms: number) =>
  steps.reduce((value, [at, level]) => (at <= ms ? level : value), steps[0][1])

const stepInputs = (pin: string, steps: ReadonlyArray<readonly [number, number]>) => steps.map(([at, value]) => `${pin}@${at}=${value}`)

const s3 = (() => {
  // A person walks past once; a second pass during the 2.5 s block time is not seen.
  const motion = pirOutput([WARM_UP_CROSSING, [36000, 37000], [41000, 41500]])
  return {
    recipeId: 'S3',
    endMs: 50000,
    inputs: levelInputs(PIR, motion),
    behavior: {
      recipeId: 'S3',
      header: 'time_ms,motion',
      allowedComments: ['# 센서가 안정될 때까지 30초 기다립니다. 그동안 감지 범위를 비워 두세요.'],
      phases: wholeRun({ motion: { oneOf: [0, 1], tolerance: 0 } }),
      checkRows: (rows) => [...startsAfterWarmUp(rows), ...followsWindows('motion', motion, 5)(rows)],
      timeColumn: 'time_ms',
      sampleInterval: { min: 249, max: 262 },
      minRows: 60,
    },
  } satisfies SketchHostSpec
})()

const SERVO_PIN = 9

const automaticDoor = (() => {
  const motion = pirOutput([WARM_UP_CROSSING, [40000, 41000]])
  // The door stays open while the PIR sees someone and for holdOpenMs (3 s) after.
  const open: Window[] = motion.filter(([start]) => start >= WARM_UP_MS).map(([start, end]) => [start, end + 3000])
  return {
    recipeId: 'automatic-door',
    endMs: 60000,
    inputs: levelInputs(PIR, motion),
    trace: [SERVO_PIN],
    behavior: {
      recipeId: 'automatic-door',
      header: 'time_ms,door_state',
      phases: wholeRun({ door_state: { oneOf: [0, 1], tolerance: 0 } }),
      checkRows: (rows) => [
        ...followsWindows('door_state', open, 50)(rows),
        ...reactsWithin('door_state', open, 50)(rows),
      ],
      minRows: 25,
    },
    // SG90: a pulse every 20 ms; 544 µs holds 0° (closed), 1472 µs 90° (open),
    // the Servo library's 544-2400 µs span. Held closed through the warm-up.
    checkTrace: (edges: readonly TraceEdge[]) => {
      const failures: string[] = []
      const all = pulses(edges, SERVO_PIN)
      if (all.length === 0 || all[0][0] > 50000) failures.push('no servo pulse in the first 50 ms')
      all.forEach(([rise, width], index) => {
        const ms = rise / 1000
        const nearEdge = open.some(([start, end]) => Math.abs(ms - start) < 50 || Math.abs(ms - end) < 50)
        const expected = within(ms, open) ? 1472 : 544
        if (!nearEdge && Math.abs(width - expected) > 10) failures.push(`${ms.toFixed(1)} ms: ${width} µs pulse, expected ${expected} µs`)
        const next = all[index + 1]
        if (next && (next[0] - rise < 18000 || next[0] - rise > 22000)) failures.push(`${ms.toFixed(1)} ms: servo frame of ${(next[0] - rise) / 1000} ms, expected about 20 ms`)
      })
      return failures.slice(0, 10)
    },
  } satisfies SketchHostSpec
})()

const nightActivity = (() => {
  // Day until 100 s, then night; a CdS divider reads about 800 by day, 200 at night.
  const light = [[0, 800], [100000, 200]] as const
  // One pass by day, two at night. The second night pass retriggers once
  // inside its hold time, which is still one visit.
  const motion = pirOutput([WARM_UP_CROSSING, [50000, 51000], [120000, 121000], [150000, 152000], [153000, 153500]])
  const nightVisits = motion.filter(([start]) => stepAt(light, start) < 350).map(([start]) => start)
  return {
    recipeId: 'night-activity',
    endMs: 200000,
    inputs: [...stepInputs('A0', light), ...levelInputs(PIR, motion)],
    behavior: {
      recipeId: 'night-activity',
      header: 'time_ms,light_adc,motion,dark_motion_count',
      phases: wholeRun(),
      checkRows: (rows) => [
        ...startsAfterWarmUp(rows),
        ...followsWindows('motion', motion.filter(([start]) => start >= WARM_UP_MS), 600)(rows),
        ...reactsWithin('motion', motion.filter(([start]) => start >= WARM_UP_MS), 600)(rows),
        ...rows.flatMap(({ values }) => {
          const ms = values.time_ms
          if ([light[1][0], ...nightVisits].some((edge) => Math.abs(ms - edge) < 600)) return []
          const count = nightVisits.filter((visit) => visit <= ms).length
          return [
            ...(values.light_adc === stepAt(light, ms) ? [] : [`${ms} ms: light_adc ${values.light_adc}, expected ${stepAt(light, ms)}`]),
            ...(values.dark_motion_count === count ? [] : [`${ms} ms: dark_motion_count ${values.dark_motion_count}, expected ${count} night visits`]),
          ]
        }),
        // A row at least every minute, so a quiet night still leaves a record.
        ...rows.slice(1).flatMap((row, index) => {
          const gap = row.values.time_ms - rows[index].values.time_ms
          return gap > 60600 ? [`${gap} ms without a row after ${rows[index].values.time_ms} ms`] : []
        }),
      ],
      minRows: 7,
    },
  } satisfies SketchHostSpec
})()

const RELAY_PIN = 7
// Light from the lamp itself reaching the CdS.
const LAMP_FEEDBACK_ADC = 150
const smartLightingInputs = (ambient: ReadonlyArray<readonly [number, number]>, motion: readonly Window[]) => [
  ...stepInputs('A0', ambient),
  `A0+${LAMP_FEEDBACK_ADC}:D${RELAY_PIN}`,
  ...levelInputs(PIR, motion),
]

/** Lamp rows and relay edges must both follow `lamp`, and the CdS sees the lamp's own light. */
function lampChecks(ambient: ReadonlyArray<readonly [number, number]>, lamp: readonly Window[], occupied: readonly Window[]) {
  return {
    checkRows: (rows: readonly ParsedRow[]) => [
      ...startsAfterWarmUp(rows),
      ...followsWindows('lamp', lamp, 300)(rows),
      ...reactsWithin('lamp', lamp, 300)(rows),
      ...followsWindows('occupied', occupied, 300)(rows),
      ...rows.flatMap(({ values }) => {
        const ms = values.time_ms
        if ([...ambient.map(([at]) => at), ...lamp.flat()].some((edge) => Math.abs(ms - edge) < 300)) return []
        const expected = stepAt(ambient, ms) + (within(ms, lamp) ? LAMP_FEEDBACK_ADC : 0)
        return values.light_adc === expected ? [] : [`${ms} ms: light_adc ${values.light_adc}, expected ${expected}`]
      }),
    ],
    checkTrace: (edges: readonly TraceEdge[]) => {
      const relay = edges.filter((edge) => edge.pin === RELAY_PIN && edge.us > 0)
      const expected = lamp.flatMap(([start, end]) => [[start, 1], [end, 0]] as const)
      if (relay.length !== expected.length) return [`relay switched ${relay.length} times, expected ${expected.length}`]
      return relay.flatMap((edge, index) => {
        const [at, value] = expected[index]
        return edge.value !== value || Math.abs(edge.us / 1000 - at) > 300
          ? [`relay ${edge.value ? 'on' : 'off'} at ${(edge.us / 1000).toFixed(0)} ms, expected ${value ? 'on' : 'off'} near ${at} ms`]
          : []
      })
    },
  }
}

const smartLighting = (() => {
  // Bright until 60 s, dark until 100 s, then bright again.
  const ambient = [[0, 600], [60000, 250], [100000, 600]] as const
  const motion = pirOutput([WARM_UP_CROSSING, [40000, 41000], [90000, 91000]])
  // Occupied for holdOnMs (30 s) after the PIR last reads HIGH.
  const occupied: Window[] = [[40000, 74000], [90000, 130000]]
  // On while occupied and dark. The lamp's own light (250 + 150) stays below the
  // 450 switch-off level, so it does not turn itself off.
  const lamp: Window[] = [[60000, 74000], [90000, 100000]]
  return {
    recipeId: 'smart-lighting',
    endMs: 120000,
    inputs: smartLightingInputs(ambient, motion),
    trace: [RELAY_PIN],
    behavior: {
      recipeId: 'smart-lighting',
      header: 'time_ms,light_adc,occupied,lamp',
      phases: wholeRun(),
      checkRows: lampChecks(ambient, lamp, occupied).checkRows,
      timeColumn: 'time_ms',
      sampleInterval: { min: 249, max: 262 },
      minRows: 300,
    },
    checkTrace: lampChecks(ambient, lamp, occupied).checkTrace,
  } satisfies SketchHostSpec
})()

const smartLightingLongHold = (() => {
  // The guide's third run, holdOnMs = 60000, in a dark room nobody enters.
  const ambient = [[0, 250]] as const
  const motion = pirOutput([WARM_UP_CROSSING])
  return {
    recipeId: 'smart-lighting',
    name: 'holdOnMs = 60000, dark and empty',
    sketchEdits: [{ from: 'unsigned long holdOnMs = 30000;', to: 'unsigned long holdOnMs = 60000;' }],
    endMs: 100000,
    inputs: smartLightingInputs(ambient, motion),
    trace: [RELAY_PIN],
    behavior: {
      recipeId: 'smart-lighting',
      header: 'time_ms,light_adc,occupied,lamp',
      phases: wholeRun(),
      checkRows: lampChecks(ambient, [], []).checkRows,
      timeColumn: 'time_ms',
      sampleInterval: { min: 249, max: 262 },
      minRows: 250,
    },
    checkTrace: lampChecks(ambient, [], []).checkTrace,
  } satisfies SketchHostSpec
})()

export const sketchHostSpecs: readonly SketchHostSpec[] = [s3, automaticDoor, nightActivity, smartLighting, smartLightingLongHold]
