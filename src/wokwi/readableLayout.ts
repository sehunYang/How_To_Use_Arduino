export interface Point {
  x: number
  y: number
}

export interface ReadableWire {
  id: string
  net: string
  from: string
  to: string
  color: string
  points: Point[]
  /** Wokwi target-pin-side route instructions, written after the `*` separator. */
  targetPath?: string[]
  allowCrossings?: string[]
}

export interface ReadablePart {
  id: string
  type: string
  top: number
  left: number
  rotate?: number
  attrs?: Record<string, string>
  pins?: string[]
  bounds?: { left: number; top: number; right: number; bottom: number }
}

export interface ReadableLayout {
  version: 1
  author: string
  minimumClearance: number
  parts: ReadablePart[]
  wires: ReadableWire[]
}

export type LayoutIssueCode =
  | 'invalid-layout-value'
  | 'unknown-endpoint-part'
  | 'duplicate-wire-id'
  | 'duplicate-endpoint'
  | 'non-orthogonal-segment'
  | 'zero-length-segment'
  | 'wire-segment-overlap'
  | 'wire-clearance-too-small'
  | 'wire-crossing'
  | 'wire-over-connected-hole'
  | 'wire-through-part'

export interface LayoutIssue {
  code: LayoutIssueCode
  severity: 'error'
  message: string
  wires: string[]
  segmentIndexes?: number[]
}

interface Segment {
  wire: ReadableWire
  index: number
  a: Point
  b: Point
  horizontal: boolean
}

const ordered = (a: number, b: number): [number, number] => (a <= b ? [a, b] : [b, a])

function segments(wire: ReadableWire): Segment[] {
  return wire.points.slice(1).map((point, index) => {
    const previous = wire.points[index]
    return {
      wire,
      index,
      a: previous,
      b: point,
      horizontal: previous.y === point.y,
    }
  })
}

function issue(
  code: LayoutIssueCode,
  message: string,
  wires: string[],
  segmentIndexes?: number[],
): LayoutIssue {
  return { code, severity: 'error', message, wires, segmentIndexes }
}

/** Strict, photo-oriented validation. Every issue is generation-blocking. */
export function validateReadableLayout(layout: ReadableLayout): LayoutIssue[] {
  const issues: LayoutIssue[] = []
  const ids = new Set<string>()
  const endpoints = new Map<string, string>()
  const partIds = new Set<string>()
  const partsById = new Map<string, ReadablePart>()

  if (!Number.isFinite(layout.minimumClearance) || layout.minimumClearance <= 0) {
    issues.push(
      issue(
        'invalid-layout-value',
        'minimumClearance must be a positive finite number.',
        [],
      ),
    )
  }

  for (const part of layout.parts) {
    if (partIds.has(part.id)) {
      issues.push(issue('invalid-layout-value', `Part id "${part.id}" is duplicated.`, []))
    }
    partIds.add(part.id)
    partsById.set(part.id, part)
    if (
      part.bounds &&
      (!Object.values(part.bounds).every(Number.isFinite) ||
        part.bounds.left >= part.bounds.right ||
        part.bounds.top >= part.bounds.bottom)
    ) {
      issues.push(issue('invalid-layout-value', `Part "${part.id}" has invalid bounds.`, []))
    }
  }

  for (const wire of layout.wires) {
    if (ids.has(wire.id)) {
      issues.push(issue('duplicate-wire-id', `Wire id "${wire.id}" is duplicated.`, [wire.id]))
    }
    ids.add(wire.id)

    for (const endpoint of [wire.from, wire.to]) {
      const separator = endpoint.indexOf(':')
      const endpointPart = separator > 0 ? endpoint.slice(0, separator) : ''
      if (!partIds.has(endpointPart)) {
        issues.push(
          issue(
            'unknown-endpoint-part',
            `Endpoint "${endpoint}" does not reference a declared part.`,
            [wire.id],
          ),
        )
      } else {
        const pin = endpoint.slice(separator + 1)
        const declaredPins = partsById.get(endpointPart)?.pins
        if (!declaredPins?.includes(pin)) {
          issues.push(
            issue(
              'unknown-endpoint-part',
              `Endpoint "${endpoint}" does not reference a declared pin.`,
              [wire.id],
            ),
          )
        }
      }
      const owner = endpoints.get(endpoint)
      if (owner) {
        issues.push(
          issue(
            'duplicate-endpoint',
            `Physical endpoint "${endpoint}" is occupied by both "${owner}" and "${wire.id}".`,
            [owner, wire.id],
          ),
        )
      } else {
        endpoints.set(endpoint, wire.id)
      }
    }

    if (wire.points.length < 2) {
      issues.push(
        issue(
          'invalid-layout-value',
          `"${wire.id}" must contain at least two route points.`,
          [wire.id],
        ),
      )
    }
    if (wire.points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
      issues.push(
        issue('invalid-layout-value', `"${wire.id}" contains a non-finite coordinate.`, [wire.id]),
      )
    }
    if (
      wire.targetPath?.some(
        (command) =>
          !/^[hv]-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(command) ||
          Number(command.slice(1)) === 0,
      )
    ) {
      issues.push(
        issue(
          'invalid-layout-value',
          `"${wire.id}" contains an invalid or zero-length targetPath instruction.`,
          [wire.id],
        ),
      )
    }

    segments(wire).forEach((segment) => {
      const dx = segment.b.x - segment.a.x
      const dy = segment.b.y - segment.a.y
      if (dx === 0 && dy === 0) {
        issues.push(
          issue('zero-length-segment', `"${wire.id}" contains a zero-length segment.`, [wire.id], [
            segment.index,
          ]),
        )
      } else if (dx !== 0 && dy !== 0) {
        issues.push(
          issue(
            'non-orthogonal-segment',
            `"${wire.id}" segment ${segment.index} is diagonal; only horizontal/vertical routing is allowed.`,
            [wire.id],
            [segment.index],
          ),
        )
      }
    })
  }

  const allSegments = layout.wires.flatMap(segments).filter((segment) => {
    const dx = segment.b.x - segment.a.x
    const dy = segment.b.y - segment.a.y
    return (dx === 0) !== (dy === 0)
  })

  for (let i = 0; i < allSegments.length; i += 1) {
    const a = allSegments[i]
    for (let j = i + 1; j < allSegments.length; j += 1) {
      const b = allSegments[j]
      const sameWire = a.wire.id === b.wire.id
      if (sameWire && Math.abs(a.index - b.index) <= 1) continue

      if (a.horizontal === b.horizontal) {
        const aFixed = a.horizontal ? a.a.y : a.a.x
        const bFixed = b.horizontal ? b.a.y : b.a.x
        const [aMin, aMax] = ordered(a.horizontal ? a.a.x : a.a.y, a.horizontal ? a.b.x : a.b.y)
        const [bMin, bMax] = ordered(b.horizontal ? b.a.x : b.a.y, b.horizontal ? b.b.x : b.b.y)
        const overlap = Math.min(aMax, bMax) - Math.max(aMin, bMin)

        if (aFixed === bFixed && overlap > 0) {
          issues.push(
            issue(
              'wire-segment-overlap',
              `"${a.wire.id}" and "${b.wire.id}" share a visible segment.`,
              [a.wire.id, b.wire.id],
              [a.index, b.index],
            ),
          )
        } else if (
          overlap > 0 &&
          Math.abs(aFixed - bFixed) < layout.minimumClearance
        ) {
          issues.push(
            issue(
              'wire-clearance-too-small',
              `"${a.wire.id}" and "${b.wire.id}" are ${Math.abs(aFixed - bFixed)}px apart; minimum is ${layout.minimumClearance}px.`,
              [a.wire.id, b.wire.id],
              [a.index, b.index],
            ),
          )
        }
        continue
      }

      const h = a.horizontal ? a : b
      const v = a.horizontal ? b : a
      const [hx1, hx2] = ordered(h.a.x, h.b.x)
      const [vy1, vy2] = ordered(v.a.y, v.b.y)
      const crossing = { x: v.a.x, y: h.a.y }
      if (crossing.x < hx1 || crossing.x > hx2 || crossing.y < vy1 || crossing.y > vy2) continue
      const explicitlyAllowed =
        !sameWire &&
        h.wire.allowCrossings?.includes(v.wire.id) === true &&
        v.wire.allowCrossings?.includes(h.wire.id) === true
      if (!explicitlyAllowed) {
        issues.push(
          issue(
            'wire-crossing',
            `"${h.wire.id}" crosses "${v.wire.id}" without mutual allowCrossings declarations.`,
            [h.wire.id, v.wire.id],
            [h.index, v.index],
          ),
        )
      }
    }
  }

  for (const segment of allSegments) {
    for (const owner of layout.wires) {
      if (owner.id === segment.wire.id || owner.points.length < 2) continue
      const protectedEndpoints = [
        { ref: owner.from, point: owner.points[0] },
        { ref: owner.to, point: owner.points.at(-1)! },
      ]

      for (const endpoint of protectedEndpoints) {
        const [x1, x2] = ordered(segment.a.x, segment.b.x)
        const [y1, y2] = ordered(segment.a.y, segment.b.y)
        const distance = segment.horizontal
          ? Math.abs(endpoint.point.y - segment.a.y)
          : Math.abs(endpoint.point.x - segment.a.x)
        const withinSpan = segment.horizontal
          ? endpoint.point.x >= x1 && endpoint.point.x <= x2
          : endpoint.point.y >= y1 && endpoint.point.y <= y2

        if (withinSpan && distance < layout.minimumClearance) {
          issues.push(
            issue(
              'wire-over-connected-hole',
              `"${segment.wire.id}" passes within ${distance}px of connected hole "${endpoint.ref}" owned by "${owner.id}"; minimum clearance is ${layout.minimumClearance}px.`,
              [segment.wire.id, owner.id],
              [segment.index],
            ),
          )
        }
      }
    }

    for (const part of layout.parts) {
      if (!part.bounds) continue
      const [x1, x2] = ordered(segment.a.x, segment.b.x)
      const [y1, y2] = ordered(segment.a.y, segment.b.y)
      const intersects =
        x2 > part.bounds.left &&
        x1 < part.bounds.right &&
        y2 > part.bounds.top &&
        y1 < part.bounds.bottom
      if (intersects) {
        issues.push(
          issue(
            'wire-through-part',
            `"${segment.wire.id}" passes through part "${part.id}".`,
            [segment.wire.id],
            [segment.index],
          ),
        )
      }
    }
  }

  return issues
}

function segmentCommand(from: Point, to: Point): string {
  if (from.x === to.x) return `v${to.y - from.y}`
  if (from.y === to.y) return `h${to.x - from.x}`
  throw new Error('Cannot compile a diagonal segment.')
}

export function compileReadableLayout(layout: ReadableLayout) {
  const issues = validateReadableLayout(layout)
  if (issues.length > 0) {
    const details = issues.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
    throw new Error(`Wokwi layout validation failed:\n${details}`)
  }

  return {
    version: 1 as const,
    author: layout.author,
    editor: 'wokwi' as const,
    parts: layout.parts.map(({ bounds: _bounds, pins: _pins, ...part }) => ({
      ...part,
      attrs: part.attrs ?? {},
    })),
    connections: layout.wires.map((wire) => {
      const sourcePath = wire.points
        .slice(1)
        .map((point, index) => segmentCommand(wire.points[index], point))
      return [
        wire.from,
        wire.to,
        wire.color,
        wire.targetPath?.length ? [...sourcePath, '*', ...wire.targetPath] : sourcePath,
      ]
    }),
  }
}
