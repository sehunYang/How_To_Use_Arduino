/**
 * Deterministic, synchronous, portable (browser + Node) change-detection
 * hash — intentionally NOT cryptographic. It exists so the client-side
 * SimBadge (Phase 3) can compute `hash(recipe)` and compare it against
 * `simStatus.verifyHash` without an async Web Crypto round-trip, and so CI
 * computes the identical value when writing that field (plan N4).
 *
 * Covers sketch + wiring + tunables + baudRate + inventoryVersion —
 * deliberately wider than just the sketch, so either a wiring-only edit or
 * a changed sensor definition invalidates the hash.
 */

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`
}

function fnv1a(str: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export interface VerifyHashInput {
  sketch: string
  wiring: unknown
  tunables: unknown
  baudRate: number
  inventoryVersion: string
}

export function computeVerifyHash(input: VerifyHashInput): string {
  return `fnv1a:${fnv1a(stableStringify(input))}`
}

export interface InventoryVersionInput {
  sensors: readonly { id: string }[]
  actuators: readonly { id: string }[]
}

/**
 * Content-derived inventory version. Sorting by id makes the version
 * independent of seed-file ordering while still changing when any sensor or
 * actuator contract changes.
 */
export function computeInventoryVersion(input: InventoryVersionInput): string {
  const byId = (a: { id: string }, b: { id: string }) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  const canonical = {
    sensors: [...input.sensors].sort(byId),
    actuators: [...input.actuators].sort(byId),
  }
  return `inventory-fnv1a:${fnv1a(stableStringify(canonical))}`
}
