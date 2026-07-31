import {
  actuators,
  wokwiAuxiliaryParts,
  type WokwiAuxiliaryPart,
} from '@/data/inventory-seed/actuators'
import type { Actuator, Recipe, Sensor, WokwiDescriptor } from '@/schema'

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

  const instanceBase = upper.replace(/_(?:\d+|ALL)$/, '')
  if (instanceBase === upper) return undefined
  return sensors.find((s) => s.id.toUpperCase() === instanceBase || s.name.toUpperCase() === instanceBase)
}

export interface PlannedWiringConnection {
  from: string
  to: string
  color: string
  stepIndex: number
}

export function planBreadboardWiring(recipe: Recipe): PlannedWiringConnection[] {
  const adjacency = new Map<string, Set<string>>()
  const connect = (from: string, to: string) => {
    if (!adjacency.has(from)) adjacency.set(from, new Set())
    if (!adjacency.has(to)) adjacency.set(to, new Set())
    adjacency.get(from)!.add(to)
    adjacency.get(to)!.add(from)
  }
  recipe.wiring.forEach((step) => connect(step.from, step.to))

  const netByEndpoint = new Map<string, string[]>()
  const visited = new Set<string>()
  for (const endpoint of adjacency.keys()) {
    if (visited.has(endpoint)) continue
    const net: string[] = []
    const pending = [endpoint]
    while (pending.length) {
      const current = pending.pop()!
      if (visited.has(current)) continue
      visited.add(current)
      net.push(current)
      pending.push(...(adjacency.get(current) ?? []))
    }
    net.forEach((member) => netByEndpoint.set(member, net))
  }

  const boardNet = new Map<string[], { holes: Map<string, string>; connected: Set<string> }>()
  const nets = [...new Set(netByEndpoint.values())]
  const netTraits = (net: string[]) => {
    const hasExplicitBoard = net.some((endpoint) => endpoint.toUpperCase().startsWith('BB.'))
    const unoPins = net
      .filter((endpoint) => endpoint.toUpperCase().startsWith('UNO.'))
      .map((endpoint) => endpoint.slice(endpoint.indexOf('.') + 1).toUpperCase())
    const isFiveVolt = unoPins.includes('5V')
    const isThreeVolt = unoPins.includes('3.3V')
    const isGround = unoPins.includes('GND')
    const hasUno = unoPins.length > 0
    const hasBoardMountedPart = net.some((endpoint) => {
      const token = endpoint.slice(0, endpoint.indexOf('.')).toUpperCase()
      return /^LED(?:_\d+)?$/.test(token)
        || /^BUZZER(?:_\d+)?$/.test(token)
        || token.includes('RESISTOR')
        || token === 'LOAD'
        || token === 'LAMP'
    })
    const needsJunction = net.length > 2 || !hasUno || hasBoardMountedPart
    return { hasExplicitBoard, isFiveVolt, isThreeVolt, isGround, needsJunction }
  }
  const terminalNets = nets.filter((net) => {
    const traits = netTraits(net)
    return !traits.hasExplicitBoard
      && !traits.isFiveVolt
      && !traits.isThreeVolt
      && !traits.isGround
      && traits.needsJunction
  })
  const terminalPitch = terminalNets.length <= 1
    ? 4
    : Math.max(1, Math.min(4, Math.floor(29 / (terminalNets.length - 1))))
  let terminalIndex = 0

  for (const net of nets) {
    const { hasExplicitBoard, isFiveVolt, isThreeVolt, isGround, needsJunction } = netTraits(net)
    if (hasExplicitBoard || (!isFiveVolt && !isThreeVolt && !isGround && !needsJunction)) continue

    const holes = new Map<string, string>()
    if (isFiveVolt || isThreeVolt || isGround) {
      const rail = isGround ? 'tn' : isThreeVolt ? 'bp' : 'tp'
      const orderedEndpoints = [...net].sort((left, right) => {
        const leftIsUno = left.toUpperCase().startsWith('UNO.')
        const rightIsUno = right.toUpperCase().startsWith('UNO.')
        return Number(rightIsUno) - Number(leftIsUno)
      })
      const railPitch = orderedEndpoints.length <= 1
        ? 4
        : Math.max(1, Math.min(4, Math.floor(24 / (orderedEndpoints.length - 1))))
      orderedEndpoints.forEach((endpoint, index) => {
        holes.set(endpoint, `BB.${rail}.${1 + index * railPitch}`)
      })
    } else {
      const rows = ['a', 'b', 'c', 'd', 'e']
      if (net.length > rows.length) {
        throw new Error(
          `planBreadboardWiring: terminal-strip net has ${net.length} endpoints; `
          + 'a single breadboard column supports at most 5',
        )
      }
      const terminalColumn = 1 + terminalIndex * terminalPitch
      net.forEach((endpoint, index) => holes.set(endpoint, `BB.${terminalColumn}t.${rows[index]}`))
      terminalIndex += 1
    }
    boardNet.set(net, { holes, connected: new Set() })
  }

  return recipe.wiring.flatMap((step, stepIndex) => {
    const net = netByEndpoint.get(step.from)!
    const plan = boardNet.get(net)
    if (!plan) return [{ from: step.from, to: step.to, color: step.color, stepIndex }]

    const connections: PlannedWiringConnection[] = []
    for (const endpoint of [step.from, step.to]) {
      if (plan.connected.has(endpoint)) continue
      plan.connected.add(endpoint)
      connections.push({
        from: endpoint,
        to: plan.holes.get(endpoint)!,
        color: step.color,
        stepIndex,
      })
    }
    return connections
  })
}

interface ResolvableComponent {
  id: string
  pins?: readonly { name: string }[]
  wokwi: WokwiDescriptor
  muxChannels?: number
}

function matchesToken(component: ResolvableComponent, token: string): boolean {
  const upper = token.toUpperCase()
  return component.id.toUpperCase() === upper
    || component.wokwi.aliases?.some((alias) => alias.toUpperCase() === upper) === true
}

function resolveComponent<T extends ResolvableComponent>(
  token: string,
  components: readonly T[],
): T | undefined {
  const exact = components.find((component) => matchesToken(component, token))
  if (exact) return exact

  const instanceBase = token.replace(/_\d+$/, '')
  if (instanceBase === token) return undefined
  return components.find((component) => matchesToken(component, instanceBase))
}

/** Resolves a declared logical pin name through a component's wokwi.pinMap. */
function resolvePin(
  component: ResolvableComponent,
  pin: string,
  componentKind = 'component',
): string {
  const muxChannel = /^(?:SC|SD)(\d+)$/.exec(pin)
  if (muxChannel && Number(muxChannel[1]) < (component.muxChannels ?? 0)) {
    return pin
  }

  if (component.pins && !component.pins.some((candidate) => candidate.name === pin)) {
    throw new Error(
      `buildDiagram: logical pin "${pin}" is not declared on ${componentKind} "${component.id}"`,
    )
  }

  const wokwiPin = component.wokwi.pinMap[pin]
  if (wokwiPin === undefined) {
    throw new Error(
      `buildDiagram: logical pin "${pin}" on ${componentKind} "${component.id}" has no Wokwi pin mapping`,
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
  availableActuators: Actuator[] = actuators,
): { partId: string; pin: string; sensor: Sensor | undefined } {
  const [token, pin] = splitRef(ref)
  if (token.toUpperCase() === UNO_TOKEN) return { partId: UNO_PART_ID, pin, sensor: undefined }
  if (token.toUpperCase() === BREADBOARD_TOKEN) {
    return { partId: BREADBOARD_PART_ID, pin, sensor: undefined }
  }

  const sensor = resolveSensor(token, sensors)
  if (sensor) {
    return { partId: token.toLowerCase(), pin: resolvePin(sensor, pin, 'sensor'), sensor }
  }

  const actuator = resolveComponent(token, availableActuators)
  if (actuator) {
    return { partId: token.toLowerCase(), pin: resolvePin(actuator, pin), sensor: undefined }
  }

  const auxiliary = resolveComponent(
    token,
    wokwiAuxiliaryParts as Array<WokwiAuxiliaryPart & ResolvableComponent>,
  )
  if (!auxiliary) {
    // Emitting the connection anyway would produce a diagram whose endpoint
    // references a part that was never added to parts[] — a dangling wire
    // that no L1 check catches (those validate recipe.sensors[], not the
    // wiring tokens themselves).
    throw new Error(
      `buildDiagram: wiring token "${token}" does not resolve to any known sensor or actuator`,
    )
  }
  return { partId: token.toLowerCase(), pin: resolvePin(auxiliary, pin), sensor: undefined }
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
  const parts: DiagramPart[] = [
    { id: UNO_PART_ID, type: 'wokwi-arduino-uno', top: 0, left: 0 },
    { id: BREADBOARD_PART_ID, type: 'wokwi-breadboard-half', top: 0, left: PART_SPACING },
  ]
  const seenPartIds = new Set([UNO_PART_ID, BREADBOARD_PART_ID])
  let nextLeft = PART_SPACING
  const recipeActuators = actuators.filter((actuator) => recipe.actuators.includes(actuator.id))

  function resolveEndpoint(ref: string): string {
    const [token] = splitRef(ref)
    const { partId, pin, sensor } = resolveWiringRef(ref, sensors, recipeActuators)

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
    if (!sensor && partId !== UNO_PART_ID && partId !== BREADBOARD_PART_ID && !seenPartIds.has(partId)) {
      const component = resolveComponent(token, recipeActuators)
        ?? resolveComponent(
          token,
          wokwiAuxiliaryParts as Array<WokwiAuxiliaryPart & ResolvableComponent>,
        )
      if (component) {
        seenPartIds.add(partId)
        parts.push({ id: partId, type: component.wokwi.part, top: 0, left: nextLeft })
        nextLeft += PART_SPACING
      }
    }
    return `${partId}:${pin}`
  }

  const connections: DiagramConnection[] = planBreadboardWiring(recipe).map((connection) => [
    resolveEndpoint(connection.from),
    resolveEndpoint(connection.to),
    connection.color,
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
