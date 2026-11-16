/**
 * Host-side sketch runs (logic/host/arduino_host.h, scripts/verify-sketch-host.ts):
 * a recipe's unmodified sketch compiled for the build machine against a virtual
 * clock. They cover sketches whose behaviour plays out over minutes, such as a
 * PIR's 30 s warm-up and hold times, which Wokwi would bill by the second.
 */

import type { ParsedRow, Phase5BehaviorSpec } from '@/wokwi/behaviorSpecHelpers'

/** [start, end) in ms of simulated time. */
export type Window = readonly [number, number]

export interface TraceEdge {
  us: number
  /** Arduino pin number (A0 = 14). */
  pin: number
  value: 0 | 1
}

export interface SketchHostSpec {
  recipeId: string
  /** Distinguishes several runs of one recipe. */
  name?: string
  /**
   * Edits a student is told to make before a run, e.g. the guide's "repeat with
   * holdOnMs = 60000". Each `from` must appear in the sketch exactly once.
   */
  sketchEdits?: Array<{ from: string; to: string }>
  /** Simulated run length. */
  endMs: number
  /** Input arguments for arduino_host.h, e.g. `D2@33000=1`. */
  inputs: string[]
  /** Digital outputs whose changes are traced. */
  trace?: number[]
  /** Judged by the same checker as the Wokwi runs; phase steps are unused. */
  behavior: Phase5BehaviorSpec
  checkTrace?: (edges: readonly TraceEdge[]) => string[]
}

/**
 * HC-SR501 OUT for people moving in front of it during `motions`, in repeatable
 * trigger mode (the H jumper, as shipped): OUT rises with motion, stays HIGH
 * while it continues and for `holdMs` after, then ignores motion for the 2.5 s
 * block time. The 3 s hold is the time-delay pot at its minimum.
 */
export function pirOutput(motions: readonly Window[], { holdMs = 3000, blockMs = 2500 } = {}): Window[] {
  const high: [number, number][] = []
  let blockedUntil = 0
  for (const [start, end] of [...motions].sort((a, b) => a[0] - b[0])) {
    const last = high.at(-1)
    if (last && start < last[1]) {
      last[1] = Math.max(last[1], end + holdMs)
    } else {
      const rise = Math.max(start, blockedUntil)
      if (rise >= end) continue
      high.push([rise, end + holdMs])
    }
    blockedUntil = high.at(-1)![1] + blockMs
  }
  return high
}

/** Input arguments that hold `pin` HIGH during `windows`. */
export const levelInputs = (pin: string, windows: readonly Window[]) =>
  windows.flatMap(([start, end]) => [`${pin}@${start}=1`, `${pin}@${end}=0`])

export const within = (ms: number, windows: readonly Window[]) => windows.some(([start, end]) => ms >= start && ms < end)

const nearEdge = (ms: number, windows: readonly Window[], slackMs: number) =>
  windows.some(([start, end]) => Math.abs(ms - start) < slackMs || Math.abs(ms - end) < slackMs)

/**
 * Rows whose `column` must be 1 inside `windows` and 0 outside. Rows within
 * `slackMs` of an edge are skipped: a sketch stamps the time before or after it
 * samples, so either value is right there.
 */
export const followsWindows = (column: string, windows: readonly Window[], slackMs: number, timeColumn = 'time_ms') =>
  (rows: readonly ParsedRow[]) =>
    rows.flatMap(({ values }) => {
      const ms = values[timeColumn]
      if (nearEdge(ms, windows, slackMs)) return []
      const expected = within(ms, windows) ? 1 : 0
      return values[column] === expected ? [] : [`${timeColumn} ${ms}: ${column} ${values[column]}, expected ${expected}`]
    })

/**
 * A change of the row value must be reported within `latencyMs` of each window
 * edge: the first row after an edge must already show it.
 */
export const reactsWithin = (column: string, windows: readonly Window[], latencyMs: number, timeColumn = 'time_ms') =>
  (rows: readonly ParsedRow[]) =>
    windows.flatMap(([start, end]) => [[start, 1], [end, 0]] as const).flatMap(([edge, value]) => {
      const first = rows.find((row) => row.values[timeColumn] >= edge && row.values[column] === value)
      if (!first) return [`${column} never became ${value} after ${edge} ms`]
      const late = first.values[timeColumn] - edge
      return late > latencyMs ? [`${column} became ${value} ${late} ms after ${edge} ms, more than ${latencyMs} ms`] : []
    })

/** HIGH pulses of `pin` as [rise µs, width µs]. */
export function pulses(edges: readonly TraceEdge[], pin: number): Array<[number, number]> {
  const result: Array<[number, number]> = []
  let rise: number | undefined
  for (const edge of edges.filter((candidate) => candidate.pin === pin)) {
    if (edge.value === 1) rise = edge.us
    else if (rise !== undefined) {
      result.push([rise, edge.us - rise])
      rise = undefined
    }
  }
  return result
}

/** Parses arduino_host.h's stderr trace lines `us,pin,value`. */
export const parseTrace = (text: string): TraceEdge[] =>
  text.split('\n').filter((line) => /^\d+,\d+,[01]$/.test(line)).map((line) => {
    const [us, pin, value] = line.split(',').map(Number)
    return { us, pin, value: value as 0 | 1 }
  })
