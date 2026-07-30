import type { Recipe, Sensor } from '@/schema'

export interface DiagramPart {
  id: string
  type: string
  top: number
  left: number
}

/** Wokwi's diagram.json connection tuple: [from, to, color, path]. */
export type DiagramConnection = [string, string, string, string[]]

export interface Diagram {
  version: 1
  author: string
  editor: 'wokwi'
  parts: DiagramPart[]
  connections: DiagramConnection[]
}

const UNO_TOKEN = 'UNO'
const UNO_PART_ID = 'uno'
const BREADBOARD_TOKEN = 'BB'
const BREADBOARD_PART_ID = 'bb'
const PART_SPACING = 100

/** Splits a `Component.Pin` wiring endpoint into its two halves. */
function splitRef(ref: string): [string, string] {
  const dotIndex = ref.indexOf('.')
  if (dotIndex === -1) return [ref, '']
  return [ref.slice(0, dotIndex), ref.slice(dotIndex + 1)]
}

/**
 * Resolves a wiring token (e.g. "TSL2591_1") to its underlying Sensor record
 * by matching against `sensor.id`/`sensor.name`, case-insensitively. Wiring
 * tokens for a second+ instance of the same sensor carry a trailing
 * `_<digits>` suffix (see multiTsl2591Recipe's `TSL2591_1`/`TSL2591_2`), so
 * an exact match is tried first and the suffix is only stripped as a
 * fallback — this avoids mis-stripping sensors whose own id genuinely ends
 * in digits (e.g. "hc-sr04", "bme280"). Purely data-driven: adding a new
 * sensor to the inventory never requires a change here (A6.1/N3).
 */
function resolveSensor(token: string, sensors: Sensor[]): Sensor | undefined {
  const upper = token.toUpperCase()
  const exact = sensors.find((s) => s.id.toUpperCase() === upper || s.name.toUpperCase() === upper)
  if (exact) return exact

  const instanceBase = upper.replace(/_\d+$/, '')
  if (instanceBase === upper) return undefined
  return sensors.find((s) => s.id.toUpperCase() === instanceBase || s.name.toUpperCase() === instanceBase)
}

/** Resolves a declared logical pin name through the sensor's wokwi.pinMap. */
function resolvePin(sensor: Sensor, pin: string): string {
  const muxChannel = /^(?:SC|SD)(\d+)$/.exec(pin)
  if (muxChannel && Number(muxChannel[1]) < sensor.muxChannels) {
    return pin
  }

  if (!sensor.pins.some((candidate) => candidate.name === pin)) {
    throw new Error(
      `buildDiagram: logical pin "${pin}" is not declared on sensor "${sensor.id}"`,
    )
  }

  const wokwiPin = sensor.wokwi.pinMap[pin]
  if (wokwiPin === undefined) {
    throw new Error(
      `buildDiagram: logical pin "${pin}" on sensor "${sensor.id}" has no Wokwi pin mapping`,
    )
  }
  return wokwiPin
}

/**
 * Resolves one `Component.Pin` wiring endpoint to the `{partId, pin}` pair it
 * denotes in Wokwi terms. Exported so the netlist checker (netlist.ts) derives
 * recipe connectivity through the exact same rule this generator uses —
 * duplicating it there would reintroduce, one layer down, the very drift the
 * netlist gate exists to prevent.
 */
export function resolveWiringRef(
  ref: string,
  sensors: Sensor[],
): { partId: string; pin: string; sensor: Sensor | undefined } {
  const [token, pin] = splitRef(ref)
  if (token.toUpperCase() === UNO_TOKEN) return { partId: UNO_PART_ID, pin, sensor: undefined }
  if (token.toUpperCase() === BREADBOARD_TOKEN) {
    return { partId: BREADBOARD_PART_ID, pin, sensor: undefined }
  }

  const sensor = resolveSensor(token, sensors)
  if (!sensor) {
    // Emitting the connection anyway would produce a diagram whose endpoint
    // references a part that was never added to parts[] — a dangling wire
    // that no L1 check catches (those validate recipe.sensors[], not the
    // wiring tokens themselves).
    throw new Error(
      `buildDiagram: wiring token "${token}" does not resolve to any known sensor or actuator`,
    )
  }
  return { partId: token.toLowerCase(), pin: resolvePin(sensor, pin), sensor }
}

/**
 * Builds a Wokwi diagram.json-shaped object from a Recipe's wiring[] and the
 * owned Sensor inventory. Every part/pin decision flows from data already on
 * the Sensor record (`wokwi.part`, `wokwi.pinMap`) — there is no per-sensor
 * branching here, so registering a new sensor never requires editing this
 * file (A6.1/N3).
 *
 * `wokwi.simSupported === false` sensors (e.g. TSL2591, INA219, TCA9548A)
 * are still emitted into parts/connections: the diagram represents wiring
 * topology, not simulation capability. `simSupported` only gates whether L3
 * attempts to actually execute the sketch against this diagram later.
 */
export function buildDiagram(recipe: Recipe, sensors: Sensor[]): Diagram {
  const parts: DiagramPart[] = [{ id: UNO_PART_ID, type: 'wokwi-arduino-uno', top: 0, left: 0 }]
  const seenPartIds = new Set([UNO_PART_ID])
  let nextLeft = PART_SPACING

  function resolveEndpoint(ref: string): string {
    const { partId, pin, sensor } = resolveWiringRef(ref, sensors)

    if (partId === BREADBOARD_PART_ID && !seenPartIds.has(partId)) {
      seenPartIds.add(partId)
      parts.push({ id: partId, type: 'wokwi-breadboard-half', top: 0, left: nextLeft })
      nextLeft += PART_SPACING
    }
    if (sensor && !seenPartIds.has(partId)) {
      seenPartIds.add(partId)
      parts.push({ id: partId, type: sensor.wokwi.part, top: 0, left: nextLeft })
      nextLeft += PART_SPACING
    }
    return `${partId}:${pin}`
  }

  const connections: DiagramConnection[] = recipe.wiring.map((step) => [
    resolveEndpoint(step.from),
    resolveEndpoint(step.to),
    step.color,
    [],
  ])

  return {
    version: 1,
    author: recipe.id,
    editor: 'wokwi',
    parts,
    connections,
  }
}
