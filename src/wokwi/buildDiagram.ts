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
  /** Wokwi part attributes, e.g. a resistor's `value` in ohms. Omitted when empty. */
  attrs?: Record<string, string>
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
 * Translates an Uno pin from recipe vocabulary into Wokwi's.
 *
 * Recipes write digital pins as `D2`/`D9` because that is what the board's
 * silkscreen, the sketch's `// @pin` manifest, and L1's UNO_PINS all use.
 * Wokwi's `wokwi-arduino-uno` part names the same headers with bare numbers
 * (`2`, `9`); analog (`A0`), power (`5V`, `3.3V`, `VIN`) and `GND` already
 * agree and pass through untouched.
 *
 * Without this the simulator rejects the endpoint as an invalid pin and drops
 * that wire, so the scenario runs against a circuit missing exactly the
 * connections the recipe is about — and still passes, because the smoke
 * scenario only waits for the sketch's ready banner.
 */
function unoWokwiPin(pin: string): string {
  const digital = /^D(\d+)$/i.exec(pin)
  return digital ? digital[1] : pin
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
  const boardMountedToken = (endpoint: string) => {
    const token = endpoint.slice(0, endpoint.indexOf('.')).toUpperCase()
    return /^LED(?:_\d+)?$/.test(token)
      || /^BUZZER(?:_\d+)?$/.test(token)
      || token.includes('RESISTOR')
      || token.includes('CAPACITOR')
      || token === 'LOAD'
      || token === 'LAMP'
  }
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

  const nets = [...new Set(netByEndpoint.values())]
  const mountedByToken = new Map<string, string[]>()
  for (const endpoint of adjacency.keys()) {
    if (!boardMountedToken(endpoint)) continue
    const token = endpoint.slice(0, endpoint.indexOf('.'))
    const endpoints = mountedByToken.get(token) ?? []
    endpoints.push(endpoint)
    mountedByToken.set(token, endpoints)
  }
  const mountedHole = new Map<string, string>()
  const mountedParts = [...mountedByToken.values()]
  const mountPitch = mountedParts.length <= 5 ? 5 : Math.max(3, Math.floor(27 / mountedParts.length))
  mountedParts.forEach((endpoints, index) => {
    const leftColumn = Math.min(27, 2 + index * mountPitch)
    const rightColumn = Math.min(29, leftColumn + 2)
    if (endpoints[0]) mountedHole.set(endpoints[0], `BB.${leftColumn}t.e`)
    if (endpoints[1]) mountedHole.set(endpoints[1], `BB.${rightColumn}t.e`)
  })
  const boardNet = new Map<string[], {
    holes: Map<string, string>
    connected: Set<string>
    bridges: Array<{ from: string; to: string }>
    bridgesEmitted: boolean
  }>()
  const netTraits = (net: string[]) => {
    const hasExplicitBoard = net.some((endpoint) => endpoint.toUpperCase().startsWith('BB.'))
    const unoPins = net
      .filter((endpoint) => endpoint.toUpperCase().startsWith('UNO.'))
      .map((endpoint) => endpoint.slice(endpoint.indexOf('.') + 1).toUpperCase())
    const isFiveVolt = unoPins.includes('5V')
    const isThreeVolt = unoPins.includes('3.3V')
    const isGround = unoPins.includes('GND')
    const hasUno = unoPins.length > 0
    const hasBoardMountedPart = net.some(boardMountedToken)
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
    const bridges: Array<{ from: string; to: string }> = []
    const mountedEndpoints = net.filter((endpoint) => mountedHole.has(endpoint))
    if (isFiveVolt || isThreeVolt || isGround) {
      const rail = isGround ? 'tn' : isThreeVolt ? 'bp' : 'tp'
      const orderedEndpoints = net.filter((endpoint) => !mountedHole.has(endpoint)).sort((left, right) => {
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
      mountedEndpoints.forEach((endpoint, index) => {
        const hole = mountedHole.get(endpoint)!
        holes.set(endpoint, hole)
        const terminalColumn = hole.match(/^BB\.(\d+)t\./)?.[1]
        if (terminalColumn) {
          const railColumn = Math.min(25, 1 + (orderedEndpoints.length + index) * railPitch)
          bridges.push({ from: `BB.${rail}.${railColumn}`, to: `BB.${terminalColumn}t.a` })
        }
      })
    } else if (mountedEndpoints.length > 0) {
      const primaryHole = mountedHole.get(mountedEndpoints[0])!
      const primaryColumn = primaryHole.match(/^BB\.(\d+)t\./)![1]
      const freeRows = ['a', 'b', 'c', 'd']
      let rowIndex = 0
      for (const endpoint of net) {
        const ownHole = mountedHole.get(endpoint)
        if (ownHole) {
          holes.set(endpoint, ownHole)
          const ownColumn = ownHole.match(/^BB\.(\d+)t\./)![1]
          if (ownColumn !== primaryColumn) {
            bridges.push({ from: `BB.${primaryColumn}t.a`, to: `BB.${ownColumn}t.a` })
          }
        } else {
          holes.set(endpoint, `BB.${primaryColumn}t.${freeRows[rowIndex++] ?? 'd'}`)
        }
      }
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
    boardNet.set(net, { holes, connected: new Set(), bridges, bridgesEmitted: false })
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
    if (!plan.bridgesEmitted) {
      plan.bridgesEmitted = true
      connections.push(...plan.bridges.map((bridge) => ({
        ...bridge,
        color: step.color,
        stepIndex,
      })))
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

/**
 * Resolves the Wokwi attributes a part is emitted with.
 *
 * A `wokwi-resistor` with no `value` simulates as the part's own 1 kΩ default,
 * regardless of what the recipe told the student to install — so a 4.7 kΩ
 * pull-up and a 220 Ω current limiter would be the same component in the rig.
 *
 * A plain `RESISTOR_<n>` token already carries its resistance in ohms, so the
 * value is read straight off the token the author wrote. That reading is
 * deliberately restricted to this exact shape: `CDS_RESISTOR_1`/`CDS_RESISTOR_2`
 * number the left and right dividers of a two-eye recipe, and taking "1" there
 * as one ohm would be worse than the default. Components whose value is fixed
 * regardless of recipe declare it once in the inventory (`wokwi.attrs`).
 */
function partAttrs(token: string, component: ResolvableComponent): Record<string, string> | undefined {
  const ohms = /^RESISTOR_(\d+)$/i.exec(token)?.[1]
  const attrs = { ...component.wokwi.attrs, ...(ohms === undefined ? {} : { value: ohms }) }
  return Object.keys(attrs).length > 0 ? attrs : undefined
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
  if (token.toUpperCase() === UNO_TOKEN) {
    return { partId: UNO_PART_ID, pin: unoWokwiPin(pin), sensor: undefined }
  }
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
        const attrs = partAttrs(token, component)
        parts.push({
          id: partId,
          type: component.wokwi.part,
          top: 0,
          left: nextLeft,
          ...(attrs === undefined ? {} : { attrs }),
        })
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
