import type { Recipe, Sensor } from '@/schema'
import { phase5BehaviorSpecById, type Phase5BehaviorSpec, type ScenarioStep } from './behaviorSpecs'
import { buildDiagram, type Diagram } from './buildDiagram'
import { recipeNetlist } from './netlist'
import type { EligiblePhase5Simulation } from './phase5SimulationRegistry'

export const PHASE5_WOKWI_ROOT = 'wokwi/phase5'
export const PHASE5_WOKWI_MANIFEST_VERSION = 1

const CUSTOM_CHIP_BY_PART_TYPE: Readonly<Record<string, string>> = {
  'chip-bme280': 'bme280',
  'chip-cds': 'cds',
  'chip-mpu6050aux': 'mpu6050aux',
  'chip-tca9548a': 'tca9548a',
  'chip-ina219': 'ina219',
  'chip-tsl2591': 'tsl2591',
}

export interface Phase5WokwiProject {
  id: string
  path: string
  timeoutMs: number
  scenario: string
  command: string
  diagram: Diagram
  sketch: string
  chips: string[]
  /** Present when the run is judged on sensor behaviour, not just boot. */
  behavior?: Phase5BehaviorSpec
}

export interface Phase5WokwiManifest {
  version: typeof PHASE5_WOKWI_MANIFEST_VERSION
  generatedFrom: 'phase5SimulationRegistry'
  projectCount: number
  exclusions: string[]
  projects: Array<Pick<
    Phase5WokwiProject,
    'id' | 'path' | 'timeoutMs' | 'scenario' | 'command' | 'chips'
  > & {
    kind: 'behavior' | 'smoke'
    /**
     * Changes whenever anything that decides this project's Wokwi verdict
     * changes: sketch, circuit, scenario, or behaviour expectations. PR runs
     * compare it with the base branch to simulate only the recipes that moved.
     */
    fingerprint: string
  }>
}

/**
 * Drops illustration-only parts (`visual-*`, e.g. the RC recipes' capacitor):
 * they exist for the student's wiring picture, Wokwi has no model for them, and
 * leaving them in only makes every run report an unknown part type.
 */
function simulatable(diagram: Diagram): Diagram {
  const illustrative = new Set(diagram.parts.filter((part) => part.type.startsWith('visual-')).map((part) => part.id))
  if (illustrative.size === 0) return diagram
  const touches = (endpoint: string) => illustrative.has(endpoint.split(':')[0])
  return {
    ...diagram,
    parts: diagram.parts.filter((part) => !illustrative.has(part.id)),
    connections: diagram.connections.filter(([from, to]) => !touches(from) && !touches(to)),
  }
}

/**
 * Swaps each CdS illustration for the divider chip (chips/cds.chip.c). The chip
 * drives the analog node itself, so the generator first proves the recipe wires
 * the divider the way the chip models it: one leg on 5 V, the other on an analog
 * pin that a single resistor pulls to GND.
 */
function withCdsChips(diagram: Diagram, recipe: Recipe, sensors: Sensor[]): Diagram {
  if (!diagram.parts.some((part) => part.type === 'visual-cds')) return diagram
  const nets = recipeNetlist(recipe, sensors)
  const netOf = (pin: string) => nets.find((net) => net.includes(pin)) ?? [pin]
  const resistorOhms = new Map(diagram.parts
    .filter((part) => part.type === 'wokwi-resistor')
    .map((part) => [part.id, Number(part.attrs?.value)]))
  const parts = diagram.parts.map((part) => {
    if (part.type !== 'visual-cds') return part
    const fail = (why: string): never => {
      throw new Error(`Phase 5 Wokwi generation: ${recipe.id} ${part.id} ${why}`)
    }
    const legs = ([1, 2] as const).map((leg) => ({ leg, net: netOf(`${part.id}:L${leg}`) }))
    const supply = legs.find(({ net }) => net.includes('uno:5V')) ?? fail('has no leg on 5V')
    const node = legs.find(({ leg }) => leg !== supply.leg)!
    if (!node.net.some((pin) => /^uno:A\d$/.test(pin))) fail('does not feed an analog pin')
    const pulls = node.net.filter((pin) => resistorOhms.has(pin.split(':')[0]))
    if (pulls.length !== 1) fail(`needs exactly one resistor on its analog node, found ${pulls.length}`)
    const [resistor, end] = pulls[0].split(':')
    if (!netOf(`${resistor}:${end === '1' ? '2' : '1'}`).includes('uno:GND')) fail(`resistor ${resistor} does not reach GND`)
    const fixedOhms = resistorOhms.get(resistor)!
    if (!(fixedOhms > 0)) fail(`resistor ${resistor} has no value`)
    return { ...part, type: 'chip-cds', attrs: { nodePin: String(node.leg), fixedOhms: String(fixedOhms), supplyVolts: '5' } }
  })
  return { ...diagram, parts }
}

/**
 * Swaps each TCA9548A for the switch chip (chips/tca9548a.chip.c). A Wokwi chip
 * cannot drive a second I2C bus, so the TSL2591s wired to the switch's channels
 * move inside it: the generator reads which channel each one sits on, drops the
 * separate parts, and tells the chip which channels carry a sensor. Their light
 * controls become `ch0Raw<n>`/`ch1Raw<n>` on the switch.
 */
function withTcaChips(diagram: Diagram, recipe: Recipe, sensors: Sensor[]): Diagram {
  if (!diagram.parts.some((part) => part.type === 'custom-tca9548a')) return diagram
  const nets = recipeNetlist(recipe, sensors)
  const netOf = (pin: string) => nets.find((net) => net.includes(pin)) ?? [pin]
  const typeOf = new Map(diagram.parts.map((part) => [part.id, part.type]))
  const absorbed = new Set<string>()
  const parts = diagram.parts.map((part) => {
    if (part.type !== 'custom-tca9548a') return part
    const fail = (why: string): never => {
      throw new Error(`Phase 5 Wokwi generation: ${recipe.id} ${part.id} ${why}`)
    }
    // The breakout pulls A0-A2 down, so an unwired strap reads 0.
    const address = [0, 1, 2].reduce((sum, bit) => {
      const net = netOf(`${part.id}:A${bit}`)
      if (net.includes('uno:5V')) return sum + (1 << bit)
      if (net.length === 1 || net.includes('uno:GND')) return sum
      return fail(`A${bit} is on neither 5V nor GND`)
    }, 0x70)
    let tslMask = 0
    for (let channel = 0; channel < 8; channel += 1) {
      const others = (pin: string) => netOf(`${part.id}:${pin}${channel}`).filter((other) => !other.startsWith(`${part.id}:`))
      const sda = others('SD')
      const scl = others('SC')
      if (sda.length === 0 && scl.length === 0) continue
      const sensor = sda[0]?.split(':')[0]
      if (sda.length !== 1 || scl.length !== 1 || sda[0] !== `${sensor}:SDA` || scl[0] !== `${sensor}:SCL`) {
        fail(`channel ${channel} must carry exactly one sensor's SDA and SCL, found ${[...sda, ...scl].join(', ')}`)
      }
      if (typeOf.get(sensor) !== 'chip-tsl2591') fail(`channel ${channel} carries ${sensor}; the switch chip only models TSL2591s`)
      absorbed.add(sensor)
      tslMask |= 1 << channel
    }
    return { ...part, type: 'chip-tca9548a', attrs: { address: String(address), tslMask: String(tslMask) } }
  })
  const touches = (endpoint: string) => absorbed.has(endpoint.split(':')[0])
  return {
    ...diagram,
    parts: parts.filter((part) => !absorbed.has(part.id)),
    connections: diagram.connections.filter(([from, to]) => !touches(from) && !touches(to)),
  }
}

/**
 * Swaps an MPU6050 with a TSL2591 on its auxiliary bus for chips/mpu6050aux.chip.c:
 * Wokwi's MPU6050 has no auxiliary I2C master, so the TSL2591 moves inside the
 * chip, its light controls with it. MPU6050s with nothing on XDA/XCL keep
 * Wokwi's own part.
 */
function withAuxMpuChips(diagram: Diagram, recipe: Recipe, sensors: Sensor[]): Diagram {
  if (!diagram.parts.some((part) => part.type === 'wokwi-mpu6050')) return diagram
  const nets = recipeNetlist(recipe, sensors)
  const netOf = (pin: string) => nets.find((net) => net.includes(pin)) ?? [pin]
  const typeOf = new Map(diagram.parts.map((part) => [part.id, part.type]))
  const absorbed = new Set<string>()
  const parts = diagram.parts.map((part) => {
    if (part.type !== 'wokwi-mpu6050') return part
    const others = (pin: string) => netOf(`${part.id}:${pin}`).filter((other) => !other.startsWith(`${part.id}:`))
    const xda = others('XDA')
    const xcl = others('XCL')
    if (xda.length === 0 && xcl.length === 0) return part
    const fail = (why: string): never => {
      throw new Error(`Phase 5 Wokwi generation: ${recipe.id} ${part.id} ${why}`)
    }
    const sensor = xda[0]?.split(':')[0]
    if (xda.length !== 1 || xcl.length !== 1 || xda[0] !== `${sensor}:SDA` || xcl[0] !== `${sensor}:SCL`) {
      fail(`auxiliary bus must carry exactly one sensor's SDA and SCL, found ${[...xda, ...xcl].join(', ')}`)
    }
    if (typeOf.get(sensor) !== 'chip-tsl2591') fail(`auxiliary bus carries ${sensor}; the chip only models a TSL2591 there`)
    if (netOf(`${part.id}:AD0`).includes('uno:5V')) fail('has AD0 high; the auxiliary-bus chip answers at 0x68 only')
    absorbed.add(sensor)
    return { ...part, type: 'chip-mpu6050aux', attrs: { ...part.attrs, tslOnAux: '1' } }
  })
  const touches = (endpoint: string) => absorbed.has(endpoint.split(':')[0])
  return {
    ...diagram,
    parts: parts.filter((part) => !absorbed.has(part.id)),
    connections: diagram.connections.filter(([from, to]) => !touches(from) && !touches(to)),
  }
}

function instrumentSketch(recipeId: string, sketch: string): string {
  const serialBegin = /Serial\.begin\(([^;]+)\);/
  if (!serialBegin.test(sketch)) {
    throw new Error(`Phase 5 Wokwi generation: recipe "${recipeId}" has no Serial.begin marker`)
  }
  return `${sketch.trimEnd().replace(
    serialBegin,
    `Serial.begin($1);\n  Serial.println("# PHASE5_READY:${recipeId}");`,
  )}\n`
}

export function buildPhase5WokwiProjects(
  entries: EligiblePhase5Simulation[],
  recipes: readonly Recipe[],
  sensors: Sensor[],
  root: string = PHASE5_WOKWI_ROOT,
): Phase5WokwiProject[] {
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]))

  return entries.map((entry) => {
    const recipe = recipesById.get(entry.recipeId)
    if (!recipe) {
      throw new Error(`Phase 5 Wokwi generation: recipe "${entry.recipeId}" was not found`)
    }

    const behavior = phase5BehaviorSpecById.get(recipe.id)
    const path = `${root}/${entry.recipeId}`
    const timeoutMs = behavior?.timeoutMs ?? entry.timeoutMs
    const scenario = 'scenario.test.yaml'
    const standIns = [withCdsChips, withTcaChips, withAuxMpuChips]
    const diagram = simulatable(standIns.reduce((built, swap) => swap(built, recipe, sensors), buildDiagram(recipe, sensors)))
    const chips = chipsOf(diagram)

    return {
      id: entry.recipeId,
      path,
      timeoutMs,
      scenario,
      command: `wokwi-cli ${path} --scenario ${scenario} --timeout ${timeoutMs}`,
      diagram,
      // A behaviour run must exercise exactly what the student uploads.
      sketch: behavior ? recipe.sketch.trimEnd() + '\n' : instrumentSketch(recipe.id, recipe.sketch),
      chips,
      ...(behavior ? { behavior } : {}),
    }
  })
}

export function renderPhase5WokwiToml(project: Pick<Phase5WokwiProject, 'chips'>): string {
  const chips = project.chips.map((chip) => [
    '',
    '[[chip]]',
    `name = "${chip}"`,
    `binary = "${chip}.chip.wasm"`,
  ].join('\n')).join('\n')

  return `${[
    '# Generated by scripts/generate-phase5-wokwi.ts. Do not edit.',
    '[wokwi]',
    'version = 1',
    'firmware = "firmware.hex"',
    'elf = "firmware.elf"',
    chips,
  ].join('\n').trimEnd()}\n`
}

function yamlString(value: string): string {
  return JSON.stringify(value)
}

function renderStep(step: ScenarioStep): string[] {
  if ('set' in step) {
    return [
      '  - set-control:',
      `      part-id: ${step.set.partId}`,
      `      control: ${step.set.control}`,
      `      value: ${step.set.value}`,
    ]
  }
  if ('waitSerial' in step) return [`  - wait-serial: ${yamlString(step.waitSerial)}`]
  if ('delayMs' in step) return [`  - delay: ${step.delayMs}ms`]
  return [
    '  - expect-pin:',
    `      part-id: ${step.expectPin.partId}`,
    `      pin: ${yamlString(step.expectPin.pin)}`,
    `      value: ${step.expectPin.value}`,
  ]
}

/** A scenario file for `steps`, as wokwi-cli reads it. */
export function renderScenario(name: string, steps: readonly ScenarioStep[]): string {
  return [`name: ${name}`, 'version: 1', 'author: phase5-generator', 'steps:', ...steps.flatMap(renderStep), ''].join('\n')
}

/** Custom chips a diagram wires in, by their wokwi.toml name. */
export function chipsOf(diagram: Diagram): string[] {
  return [...new Set(
    diagram.parts
      .map((part) => CUSTOM_CHIP_BY_PART_TYPE[part.type])
      .filter((chip): chip is string => chip !== undefined),
  )].sort()
}

function renderBehaviorScenario(id: string, spec: Phase5BehaviorSpec): string {
  const steps: ScenarioStep[] = [
    { waitSerial: spec.header },
    ...spec.phases.flatMap((phase) => phase.steps),
    ...(spec.finalSteps ?? []),
  ]
  return [
    `name: Phase 5 behavior - ${id}`,
    'version: 1',
    'author: phase5-generator',
    'steps:',
    ...steps.flatMap(renderStep),
    '',
  ].join('\n')
}

export function renderPhase5Scenario(project: Phase5WokwiProject): string {
  if (project.behavior) return renderBehaviorScenario(project.id, project.behavior)
  return [
    `name: Phase 5 deterministic smoke - ${project.id}`,
    'version: 1',
    'author: phase5-generator',
    'steps:',
    `  - wait-serial: "# PHASE5_READY:${project.id}"`,
    '',
  ].join('\n')
}

/** 64-bit change detector for manifest fingerprints. */
export function fingerprintText(text: string): string {
  return fnv1a(text, 0x811c9dc5) + fnv1a(text, 0x01000193)
}

function fnv1a(text: string, seed: number): string {
  let hash = seed
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Spec as text, with derived expectations and row checks reduced to their source. */
function serializeSpec(spec: Phase5BehaviorSpec | undefined): string {
  return JSON.stringify(spec ?? null, (_key, value: unknown) =>
    typeof value === 'function' ? value.toString() : value)
}

export function phase5ProjectFingerprint(project: Phase5WokwiProject): string {
  const text = [
    project.sketch,
    JSON.stringify(project.diagram),
    renderPhase5Scenario(project),
    String(project.timeoutMs),
    serializeSpec(project.behavior),
  ].join('\u0000')
  return fingerprintText(text)
}

export function buildPhase5WokwiManifest(
  projects: Phase5WokwiProject[],
  exclusions: string[],
): Phase5WokwiManifest {
  return {
    version: PHASE5_WOKWI_MANIFEST_VERSION,
    generatedFrom: 'phase5SimulationRegistry',
    projectCount: projects.length,
    exclusions: [...exclusions],
    projects: projects.map((project) => ({
      id: project.id,
      path: project.path,
      kind: project.behavior ? 'behavior' : 'smoke',
      timeoutMs: project.timeoutMs,
      scenario: project.scenario,
      command: project.command,
      chips: project.chips,
      fingerprint: phase5ProjectFingerprint(project),
    })),
  }
}
