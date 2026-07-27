import {
  GEOMETRY_UNAVAILABLE,
  geometryFor,
  minimumPinPitch,
  partBounds,
  pinPosition,
} from './partGeometry'

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
  /**
   * What this layout is for, which decides whether its coordinates must be
   * anchored to real Wokwi geometry.
   *
   * 'recipe'  — a circuit a student builds from and a photo is taken of.
   *             Every route must land on the pin Wokwi actually draws.
   * 'fixture' — a rig that only ever runs headless in CI. The photographic
   *             rules still apply, but geometry anchoring is skipped: parts
   *             like the breadboard and custom chips have no published pin
   *             coordinates (see GEOMETRY_UNAVAILABLE), so there is nothing to
   *             anchor against. Its layout is human-reviewed, not machine-
   *             verified — which is acceptable only because nobody builds or
   *             photographs it.
   *
   * Defaults to 'recipe': a new layout is held to the strict standard unless
   * it explicitly opts out.
   */
  purpose?: 'recipe' | 'fixture'
  /** Minimum visible gap between two parallel wire runs, in px. */
  minimumClearance: number
  /**
   * How close another wire may pass to a connected pin before it hides it, in
   * px. Deliberately NOT `minimumClearance`: that one keeps two parallel runs
   * tellable apart, while this one is about a pin staying visible, and it must
   * be smaller than the tightest header pitch or wiring a 9.5px Uno header
   * becomes impossible by construction. Defaults to DEFAULT_PIN_OBSCURE_RADIUS.
   */
  pinObscureRadius?: number
  parts: ReadablePart[]
  wires: ReadableWire[]
}

/** Roughly half a rendered wire's stroke plus margin — enough to tell "lies across the pin" from "lands beside it". */
export const DEFAULT_PIN_OBSCURE_RADIUS = 4

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
  | 'unknown-part-geometry'
  | 'unsupported-part-rotation'
  | 'pin-position-mismatch'

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

/** Ids of the parts a segment plugs directly into (empty for mid-route segments). */
function approachPartIds(
  segment: Segment,
  attachments: Map<string, ReadablePart>,
): string[] {
  const ids: string[] = []
  if (segment.index === 0) {
    const part = attachments.get(`${segment.wire.id}:from`)
    if (part) ids.push(part.id)
  }
  if (segment.index === segment.wire.points.length - 2) {
    const part = attachments.get(`${segment.wire.id}:to`)
    if (part) ids.push(part.id)
  }
  return ids
}

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
  /** `${wireId}:from` / `${wireId}:to` -> the part that end plugs into. */
  const attachments = new Map<string, ReadablePart>()
  const obscureRadius = layout.pinObscureRadius ?? DEFAULT_PIN_OBSCURE_RADIUS
  const anchorToRealGeometry = (layout.purpose ?? 'recipe') === 'recipe'

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

    if (!anchorToRealGeometry) {
      // Fixture: nothing to anchor against, and the layout says so on purpose.
    } else if (geometryFor(part.type)) {
      // Pin coordinates are transcribed for the unrotated element, so a rotated
      // part would silently validate against positions Wokwi does not use.
      if (part.rotate) {
        issues.push(
          issue(
            'unsupported-part-rotation',
            `Part "${part.id}" is rotated ${part.rotate}°, which pin-position checking does not model. Use rotate 0 or extend partGeometry.ts.`,
            [],
          ),
        )
      }
    } else {
      issues.push(
        issue(
          'unknown-part-geometry',
          `Part "${part.id}" is a "${part.type}", whose real pin positions are unavailable (${
            GEOMETRY_UNAVAILABLE[part.type] ?? 'no entry in partGeometry.ts'
          }). Routes touching it cannot be checked against what Wokwi actually draws.`,
          [],
        ),
      )
    }
  }

  for (const wire of layout.wires) {
    if (ids.has(wire.id)) {
      issues.push(issue('duplicate-wire-id', `Wire id "${wire.id}" is duplicated.`, [wire.id]))
    }
    ids.add(wire.id)

    for (const [side, endpoint] of [
      ['from', wire.from],
      ['to', wire.to],
    ] as const) {
      const separator = endpoint.indexOf(':')
      const endpointPart = separator > 0 ? endpoint.slice(0, separator) : ''

      // Anchor the author's route to where Wokwi will really draw this pin.
      // Wokwi starts the wire at the actual pin and replays the relative h/v
      // commands, so a mismatch here translates the entire rendered route.
      const part = partsById.get(endpointPart)
      const routePoint = side === 'from' ? wire.points[0] : wire.points.at(-1)
      if (part && routePoint) {
        attachments.set(`${wire.id}:${side}`, part)
        const actual = anchorToRealGeometry
          ? pinPosition(part, endpoint.slice(separator + 1))
          : null
        if (actual && (Math.abs(actual.x - routePoint.x) > 0.01 || Math.abs(actual.y - routePoint.y) > 0.01)) {
          issues.push(
            issue(
              'pin-position-mismatch',
              `"${wire.id}" ${side} point (${routePoint.x}, ${routePoint.y}) is not where Wokwi draws "${endpoint}" — that pin is at (${actual.x}, ${actual.y}).`,
              [wire.id],
            ),
          )
        }
      }

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
        } else if (overlap > 0 && Math.abs(aFixed - bFixed) < layout.minimumClearance) {
          // Two wires landing on neighbouring pins of one header are held
          // apart by the header pitch alone. Demanding more than the part
          // physically offers would make that header unwireable, so the pitch
          // becomes the floor for their final approach.
          const shared = approachPartIds(a, attachments).find((id) =>
            approachPartIds(b, attachments).includes(id),
          )
          const pitch = shared ? minimumPinPitch(partsById.get(shared)!.type) : null
          const pitchForced = pitch !== null && Math.abs(aFixed - bFixed) >= pitch - 0.01

          if (!pitchForced) {
            issues.push(
              issue(
                'wire-clearance-too-small',
                `"${a.wire.id}" and "${b.wire.id}" are ${Math.abs(aFixed - bFixed)}px apart; minimum is ${layout.minimumClearance}px.`,
                [a.wire.id, b.wire.id],
                [a.index, b.index],
              ),
            )
          }
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

      // Only pins something is actually plugged into are protected. An empty
      // breadboard hole carries no information a wire could hide, and
      // protecting all of them would forbid crossing the board at all.
      const protectedEndpoints = [
        { ref: owner.from, point: owner.points[0] },
        { ref: owner.to, point: owner.points.at(-1)! },
      ]

      for (const endpoint of protectedEndpoints) {
        const distance = segment.horizontal
          ? Math.abs(endpoint.point.y - segment.a.y)
          : Math.abs(endpoint.point.x - segment.a.x)
        if (distance >= obscureRadius) continue

        // A pin is hidden when the wire LIES ACROSS it, not when the wire
        // stops at a neighbour. So the pin must project strictly inside the
        // segment: at a segment end, the wire is terminating, not passing.
        const along = segment.horizontal ? endpoint.point.x : endpoint.point.y
        const [near, far] = ordered(
          segment.horizontal ? segment.a.x : segment.a.y,
          segment.horizontal ? segment.b.x : segment.b.y,
        )
        const passesOver = along > near + obscureRadius && along < far - obscureRadius
        if (!passesOver) continue

        issues.push(
          issue(
            'wire-over-connected-hole',
            `"${segment.wire.id}" runs across connected pin "${endpoint.ref}" (owned by "${owner.id}") at ${distance}px, hiding what it connects to; keep at least ${obscureRadius}px clear or route around.`,
            [segment.wire.id, owner.id],
            [segment.index],
          ),
        )
      }
    }

    for (const part of layout.parts) {
      // Prefer the real rendered footprint; fall back to the declared box only
      // for parts whose geometry is unavailable (already reported above).
      const bounds = (anchorToRealGeometry ? partBounds(part) : null) ?? part.bounds
      if (!bounds) continue

      // A wire is allowed to leave its own pin through its own part's
      // footprint — header pins sit inboard of the edge, so every attached
      // wire necessarily starts inside the body.
      const isOwnAttachment =
        (segment.index === 0 && attachments.get(`${segment.wire.id}:from`)?.id === part.id) ||
        (segment.index === segment.wire.points.length - 2 &&
          attachments.get(`${segment.wire.id}:to`)?.id === part.id)
      if (isOwnAttachment) continue

      const [x1, x2] = ordered(segment.a.x, segment.b.x)
      const [y1, y2] = ordered(segment.a.y, segment.b.y)
      const intersects =
        x2 > bounds.left && x1 < bounds.right && y2 > bounds.top && y1 < bounds.bottom
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

/**
 * Real pin coordinates carry decimals (a 9.5px header pitch, a pin 5.78px down
 * from the edge), so route points accumulate binary-float noise: a delta that
 * should read -55.78 comes out -55.77999999999997. Round to 0.01px — two
 * orders of magnitude finer than anything visible — so the generated diagram
 * stays diffable and `verify:wokwi-diagram` does not churn.
 */
const roundPx = (value: number): number => Math.round(value * 100) / 100

function segmentCommand(from: Point, to: Point): string {
  if (from.x === to.x) return `v${roundPx(to.y - from.y)}`
  if (from.y === to.y) return `h${roundPx(to.x - from.x)}`
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
