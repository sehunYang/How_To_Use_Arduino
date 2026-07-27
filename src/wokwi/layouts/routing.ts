import type { Point, ReadableWire } from '../readableLayout'

export type Delta = readonly ['h' | 'v', number]

function routedWire(
  wire: Omit<ReadableWire, 'points'>,
  start: Point,
  deltas: Delta[],
): ReadableWire {
  const points = [{ ...start }]
  for (const [axis, distance] of deltas) {
    const previous = points.at(-1)!
    points.push({
      x: previous.x + (axis === 'h' ? distance : 0),
      y: previous.y + (axis === 'v' ? distance : 0),
    })
  }
  return { ...wire, points }
}

/**
 * Declares one routed wire from a start pin and a run of orthogonal deltas.
 * Shared by every layout so route authoring stays uniform — each layout only
 * supplies coordinates, never its own path arithmetic.
 */
export const wire = (
  id: string,
  net: string,
  from: string,
  to: string,
  color: string,
  start: Point,
  deltas: Delta[],
  extra?: { targetPath?: string[]; allowCrossings?: string[] },
): ReadableWire =>
  routedWire(
    { id, net, from, to, color, targetPath: extra?.targetPath, allowCrossings: extra?.allowCrossings },
    start,
    deltas,
  )
