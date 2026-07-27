import type { Recipe, Sensor } from '@/schema'
import { resolveWiringRef } from './buildDiagram'
import type { ReadableLayout } from './readableLayout'

/**
 * Electrical netlist resolution for readable Wokwi layouts.
 *
 * `validateReadableLayout()` proves a layout is *photographable* — orthogonal,
 * non-overlapping, traceable by eye. It says nothing about whether the layout
 * is the circuit the recipe actually describes: it never reads `wire.net` and
 * has no model of breadboard conductivity, so a wire plugged into the wrong
 * row passes every geometric rule.
 *
 * This module closes that gap by deriving what is *electrically* true from the
 * geometry-free part of the layout (which hole each wire end occupies), then
 * checking that derivation against two independent declarations:
 *
 *   1. `wire.net` — the author's stated intent, previously never verified.
 *   2. `recipe.wiring[]` — the connections a student is told to make.
 *
 * (2) is the one that matters most: it makes "the circuit CI simulated" and
 * "the circuit the student builds" the same object by construction, which is
 * the guarantee plan 2.1 wanted from generating diagram.json out of wiring[].
 */

const BREADBOARD_TYPES = new Set([
  'wokwi-breadboard',
  'wokwi-breadboard-half',
  'wokwi-breadboard-mini',
])

/**
 * Collapses a breadboard hole onto the conductor it belongs to.
 *
 * Power rails (`tp.7`, `bn.12`, …) are one conductor per rail for the whole
 * board. Terminal strips (`15t.b`) are one conductor per column-half, so
 * `15t.a`…`15t.e` are the same node — that is exactly what makes a breadboard
 * a bus, and why a layout may route through one without adding connections
 * the recipe never declared.
 */
function breadboardNode(partId: string, pin: string): string | null {
  const rail = /^([tb][pn])\.\d+$/.exec(pin)
  if (rail) return `${partId}#rail:${rail[1]}`

  const strip = /^(\d+)([tb])\.[a-j]$/.exec(pin)
  if (strip) return `${partId}#strip:${strip[1]}${strip[2]}`

  return null
}

/**
 * Drops a pin's instance index: the Uno exposes three separate GND headers
 * (`GND.1`/`GND.2`/`GND.3`) that are one net on the board itself, so a layout
 * plugging into `GND.2` satisfies a recipe that just says `UNO.GND`.
 */
function normalizePin(pin: string): string {
  return pin.replace(/\.\d+$/, '')
}

class DisjointSet {
  private parent = new Map<string, string>()

  find(key: string): string {
    const seen = this.parent.get(key)
    if (seen === undefined) {
      this.parent.set(key, key)
      return key
    }
    if (seen === key) return key
    const root = this.find(seen)
    this.parent.set(key, root)
    return root
  }

  union(a: string, b: string): void {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) this.parent.set(rootA, rootB)
  }
}

export type NetlistIssueCode =
  | 'unknown-breadboard-pin'
  | 'net-label-conflict'
  | 'net-label-split'
  | 'netlist-mismatch'

export interface NetlistIssue {
  code: NetlistIssueCode
  severity: 'error'
  message: string
}

export interface ResolvedNet {
  /** Distinct `wire.net` labels observed on wires landing in this conductor. */
  labels: string[]
  /** Component pins on this conductor as `partId:PIN`, sorted. Breadboard holes are not components and never appear. */
  pins: string[]
}

function netIssue(code: NetlistIssueCode, message: string): NetlistIssue {
  return { code, severity: 'error', message }
}

const formatNet = (pins: string[]): string => `{${pins.join(', ')}}`

/**
 * Resolves a layout into electrical conductors, and checks the author's
 * `wire.net` labels against that resolution.
 *
 * Nets carrying no component pin (pure breadboard-to-breadboard routing) are
 * dropped — they are an artefact of how the bus was laid out, not a
 * connection the recipe could ever declare.
 */
export function layoutNetlist(layout: ReadableLayout): {
  nets: ResolvedNet[]
  issues: NetlistIssue[]
} {
  const issues: NetlistIssue[] = []
  const breadboardIds = new Set(
    layout.parts.filter((part) => BREADBOARD_TYPES.has(part.type)).map((part) => part.id),
  )

  const set = new DisjointSet()
  const componentPins = new Set<string>()

  const nodeFor = (endpoint: string): string | null => {
    const separator = endpoint.indexOf(':')
    if (separator <= 0) return null
    const partId = endpoint.slice(0, separator)
    const pin = endpoint.slice(separator + 1)

    if (breadboardIds.has(partId)) {
      const node = breadboardNode(partId, pin)
      if (!node) {
        issues.push(
          netIssue(
            'unknown-breadboard-pin',
            `Endpoint "${endpoint}" is not a recognisable breadboard hole; its conductivity cannot be resolved.`,
          ),
        )
      }
      return node
    }

    const node = `${partId}:${normalizePin(pin)}`
    componentPins.add(node)
    return node
  }

  const labelsByRoot = new Map<string, Set<string>>()

  for (const wire of layout.wires) {
    const from = nodeFor(wire.from)
    const to = nodeFor(wire.to)
    if (!from || !to) continue

    set.union(from, to)
    const root = set.find(from)
    const labels = labelsByRoot.get(root) ?? new Set<string>()
    labels.add(wire.net)
    labelsByRoot.set(root, labels)
  }

  // Union() rewires roots as it goes, so labels collected against an
  // intermediate root must be folded onto the final root before reporting.
  const merged = new Map<string, Set<string>>()
  for (const [root, labels] of labelsByRoot) {
    const finalRoot = set.find(root)
    const target = merged.get(finalRoot) ?? new Set<string>()
    labels.forEach((label) => target.add(label))
    merged.set(finalRoot, target)
  }

  const pinsByRoot = new Map<string, string[]>()
  for (const pin of componentPins) {
    const root = set.find(pin)
    pinsByRoot.set(root, [...(pinsByRoot.get(root) ?? []), pin])
  }

  const nets: ResolvedNet[] = []
  for (const [root, labels] of merged) {
    const pins = pinsByRoot.get(root)
    if (!pins?.length) continue
    nets.push({ labels: [...labels].sort(), pins: [...pins].sort() })
  }
  nets.sort((a, b) => a.pins.join().localeCompare(b.pins.join()))

  for (const net of nets) {
    if (net.labels.length > 1) {
      issues.push(
        netIssue(
          'net-label-conflict',
          `One conductor ${formatNet(net.pins)} carries conflicting net labels: ${net.labels.join(', ')}.`,
        ),
      )
    }
  }

  const rootsByLabel = new Map<string, ResolvedNet[]>()
  for (const net of nets) {
    for (const label of net.labels) {
      rootsByLabel.set(label, [...(rootsByLabel.get(label) ?? []), net])
    }
  }
  for (const [label, group] of rootsByLabel) {
    if (group.length > 1) {
      issues.push(
        netIssue(
          'net-label-split',
          `Net "${label}" is declared on ${group.length} conductors that are not electrically joined: ${group
            .map((net) => formatNet(net.pins))
            .join(' vs ')}. A bus wire is missing.`,
        ),
      )
    }
  }

  return { nets, issues }
}

/**
 * Resolves `recipe.wiring[]` into the same shape, reusing buildDiagram's
 * token/pin resolution so the two never drift apart.
 */
export function recipeNetlist(recipe: Recipe, sensors: Sensor[]): string[][] {
  const set = new DisjointSet()
  const pins = new Set<string>()

  for (const step of recipe.wiring) {
    const from = resolveWiringRef(step.from, sensors)
    const to = resolveWiringRef(step.to, sensors)
    const fromKey = `${from.partId}:${normalizePin(from.pin)}`
    const toKey = `${to.partId}:${normalizePin(to.pin)}`
    pins.add(fromKey)
    pins.add(toKey)
    set.union(fromKey, toKey)
  }

  const byRoot = new Map<string, string[]>()
  for (const pin of pins) {
    const root = set.find(pin)
    byRoot.set(root, [...(byRoot.get(root) ?? []), pin])
  }

  return [...byRoot.values()]
    .map((group) => [...group].sort())
    .sort((a, b) => a.join().localeCompare(b.join()))
}

/**
 * The gate: the conductors a layout physically creates must be exactly the
 * conductors the recipe tells a student to create — no extra sensor quietly
 * wired into the simulated bus, no declared connection missing from the rig.
 */
export function compareNetlists(layoutNets: ResolvedNet[], recipeNets: string[][]): NetlistIssue[] {
  const issues: NetlistIssue[] = []
  const key = (pins: string[]) => pins.join('|')

  const layoutKeys = new Map(layoutNets.map((net) => [key(net.pins), net.pins]))
  const recipeKeys = new Map(recipeNets.map((pins) => [key(pins), pins]))

  for (const [id, pins] of layoutKeys) {
    if (!recipeKeys.has(id)) {
      issues.push(
        netIssue(
          'netlist-mismatch',
          `Layout creates conductor ${formatNet(pins)}, which recipe.wiring[] does not declare.`,
        ),
      )
    }
  }
  for (const [id, pins] of recipeKeys) {
    if (!layoutKeys.has(id)) {
      issues.push(
        netIssue(
          'netlist-mismatch',
          `recipe.wiring[] declares conductor ${formatNet(pins)}, which the layout does not create.`,
        ),
      )
    }
  }

  return issues
}

/** Convenience wrapper: resolve, self-check labels, then compare against the recipe. */
export function validateLayoutAgainstRecipe(
  layout: ReadableLayout,
  recipe: Recipe,
  sensors: Sensor[],
): NetlistIssue[] {
  const { nets, issues } = layoutNetlist(layout)
  return [...issues, ...compareNetlists(nets, recipeNetlist(recipe, sensors))]
}
