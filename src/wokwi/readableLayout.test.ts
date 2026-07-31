import { describe, expect, it } from 'vitest'
import {
  compileReadableLayout,
  validateReadableLayout,
  type ReadableLayout,
} from './readableLayout'
import { pendulumLayout } from './layouts/pendulumLayout'
import { chipConformanceLayout } from './layouts/chipConformanceLayout'

const base = (wires: ReadableLayout['wires']): ReadableLayout => {
  const partIds = new Set(
    wires.flatMap((entry) =>
      [entry.from, entry.to].map((endpoint) => endpoint.slice(0, endpoint.indexOf(':'))),
    ),
  )
  return {
    version: 1,
    author: 'test',
    // Synthetic parts with made-up coordinates: these cases exercise the
    // geometric rules in isolation, so geometry anchoring is out of scope.
    purpose: 'fixture',
    minimumClearance: 10,
    parts: [...partIds].map((id) => ({ id, type: 'wokwi-test', top: 0, left: 0, pins: ['from', 'to'] })),
    wires,
  }
}

const wire = (id: string, points: ReadableLayout['wires'][number]['points']) => ({
  id,
  net: id,
  from: `${id}:from`,
  to: `${id}:to`,
  color: 'green',
  points,
})

/** Route builder for geometry-anchored cases, where points must be real. */
const wire2 = (
  id: string,
  from: string,
  to: string,
  start: { x: number; y: number },
  deltas: (readonly ['h' | 'v', number])[],
) => routedWire(id, from, to, start, deltas)

function routedWire(
  id: string,
  from: string,
  to: string,
  start: { x: number; y: number },
  deltas: (readonly ['h' | 'v', number])[],
): ReadableLayout['wires'][number] {
  const points = [{ ...start }]
  for (const [axis, distance] of deltas) {
    const previous = points.at(-1)!
    points.push({
      x: previous.x + (axis === 'h' ? distance : 0),
      y: previous.y + (axis === 'v' ? distance : 0),
    })
  }
  return { id, net: id, from, to, color: 'green', points }
}

describe('strict readable Wokwi layout', () => {
  it('rejects collinear overlap even when wires belong to the same logical net', () => {
    const layout = base([
      { ...wire('sda-1', [{ x: 0, y: 0 }, { x: 100, y: 0 }]), net: 'SDA' },
      { ...wire('sda-2', [{ x: 50, y: 0 }, { x: 150, y: 0 }]), net: 'SDA' },
    ])

    expect(validateReadableLayout(layout).map((entry) => entry.code)).toContain(
      'wire-segment-overlap',
    )
    expect(() => compileReadableLayout(layout)).toThrow(/wire-segment-overlap/)
  })

  it('rejects parallel routes that are too close to distinguish in a photograph', () => {
    const layout = base([
      wire('sda', [{ x: 0, y: 0 }, { x: 100, y: 0 }]),
      wire('scl', [{ x: 0, y: 6 }, { x: 100, y: 6 }]),
    ])

    expect(validateReadableLayout(layout).map((entry) => entry.code)).toContain(
      'wire-clearance-too-small',
    )
  })

  it('rejects unapproved crossings and duplicate physical holes', () => {
    const crossing = base([
      wire('horizontal', [{ x: 0, y: 20 }, { x: 40, y: 20 }]),
      wire('vertical', [{ x: 20, y: 0 }, { x: 20, y: 40 }]),
    ])
    expect(validateReadableLayout(crossing).map((entry) => entry.code)).toContain('wire-crossing')

    const duplicate = base([
      wire('first', [{ x: 0, y: 0 }, { x: 10, y: 0 }]),
      { ...wire('second', [{ x: 0, y: 20 }, { x: 10, y: 20 }]), from: 'first:from' },
    ])
    expect(validateReadableLayout(duplicate).map((entry) => entry.code)).toContain(
      'duplicate-endpoint',
    )
  })

  it('rejects diagonal routes and routes through a component body', () => {
    const diagonal = base([wire('diagonal', [{ x: 0, y: 0 }, { x: 10, y: 10 }])])
    expect(validateReadableLayout(diagonal).map((entry) => entry.code)).toContain(
      'non-orthogonal-segment',
    )

    const throughPart: ReadableLayout = {
      ...base([wire('blocked', [{ x: 0, y: 20 }, { x: 100, y: 20 }])]),
      parts: [
        {
          id: 'sensor',
          type: 'wokwi-test',
          top: 10,
          left: 40,
          bounds: { left: 40, top: 10, right: 60, bottom: 30 },
        },
      ],
    }
    expect(validateReadableLayout(throughPart).map((entry) => entry.code)).toContain(
      'wire-through-part',
    )
  })

  it('rejects incomplete, non-finite and self-intersecting routes', () => {
    const incomplete = base([wire('short', [{ x: 0, y: 0 }])])
    expect(validateReadableLayout(incomplete).map((entry) => entry.code)).toContain(
      'invalid-layout-value',
    )

    const nonFinite = base([
      wire('nan', [{ x: 0, y: 0 }, { x: Number.NaN, y: 0 }]),
    ])
    expect(() => compileReadableLayout(nonFinite)).toThrow(/non-finite/)

    const selfCrossing = base([
      wire('loop', [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 40 },
        { x: 20, y: 40 },
        { x: 20, y: -20 },
      ]),
    ])
    expect(validateReadableLayout(selfCrossing).map((entry) => entry.code)).toContain(
      'wire-crossing',
    )
  })

  it('rejects a wire that obscures a hole occupied by another wire', () => {
    const layout = base([
      wire('connected-hole', [{ x: 20, y: 20 }, { x: 20, y: 40 }]),
      wire('covering-wire', [{ x: 0, y: 20 }, { x: 40, y: 20 }]),
    ])

    expect(validateReadableLayout(layout).map((entry) => entry.code)).toContain(
      'wire-over-connected-hole',
    )
    expect(() => compileReadableLayout(layout)).toThrow(/wire-over-connected-hole/)
  })

  it('compiles only a valid orthogonal route into Wokwi path commands', () => {
    const layout = base([
      wire('signal', [
        { x: 10, y: 10 },
        { x: 10, y: 40 },
        { x: 70, y: 40 },
      ]),
    ])

    expect(compileReadableLayout(layout).connections[0]).toEqual([
      'signal:from',
      'signal:to',
      'green',
      ['v30', 'h60'],
    ])
  })

  it('compiles an explicit target-pin approach after the Wokwi star separator', () => {
    const layout = base([
      {
        ...wire('signal', [{ x: 10, y: 10 }, { x: 10, y: 40 }]),
        targetPath: ['h20', 'v-30'],
      },
    ])

    expect(compileReadableLayout(layout).connections[0]).toEqual([
      'signal:from',
      'signal:to',
      'green',
      ['v30', '*', 'h20', 'v-30'],
    ])
  })

  it('validates and compiles the production pendulum layout, anchored to real part geometry', () => {
    // 'recipe' purpose means every route point is checked against the pin
    // position Wokwi actually renders — bounds are derived, not declared.
    expect(pendulumLayout.purpose).toBe('recipe')
    expect(validateReadableLayout(pendulumLayout)).toEqual([])

    const diagram = compileReadableLayout(pendulumLayout)
    expect(diagram.connections).toEqual([
      ['mpu6050:VCC', 'uno:5V', 'red', ['v-105.78', 'h145.6', 'v-28.5']],
      ['mpu6050:GND', 'uno:GND.2', 'black', ['v-80.78', 'h164.7', 'v-53.5']],
      ['mpu6050:SDA', 'uno:A4', 'green', ['v-55.78', 'h260.4', 'v-78.5']],
      ['mpu6050:SCL', 'uno:A5', 'yellow', ['v-30.78', 'h260.3', 'v-103.5']],
    ])
  })

  describe('anchoring to real Wokwi part geometry', () => {
    // Uno bottom header: 5V(160,191.5) GND.2(169.5,191.5) A4(246,191.5) A5(255.5,191.5)
    // MPU6050 top header: SDA(45.6,5.78) SCL(55.2,5.78) GND(64.8,5.78) VCC(74.4,5.78)
    const grounded = (wires: ReadableLayout['wires']): ReadableLayout => ({
      version: 1,
      author: 'test',
      purpose: 'recipe',
      minimumClearance: 10,
      parts: [
        { id: 'uno', type: 'wokwi-arduino-uno', top: 0, left: 200, pins: ['5V', 'GND.2', 'A4', 'A5'] },
        { id: 'mpu6050', type: 'wokwi-mpu6050', top: 320, left: 140, pins: ['VCC', 'GND', 'SDA', 'SCL'] },
      ],
      wires,
    })
    const codes = (layout: ReadableLayout) => validateReadableLayout(layout).map((i) => i.code)

    it('rejects a route that does not start where Wokwi draws the pin', () => {
      const issues = codes(
        grounded([
          wire2('bad', 'mpu6050:VCC', 'uno:5V', { x: 999, y: 999 }, [['v', -673.22], ['h', -639]]),
        ]),
      )
      expect(issues).toContain('pin-position-mismatch')
    })

    it('reports parts whose real geometry is unavailable instead of silently trusting them', () => {
      const layout = grounded([])
      layout.parts.push({ id: 'bb', type: 'wokwi-breadboard', top: 0, left: 0, pins: ['5t.a'] })
      expect(codes(layout)).toContain('unknown-part-geometry')
    })

    it('uses each geometry source tolerance at the pin-position boundary', () => {
      const measured: ReadableLayout = {
        version: 1,
        author: 'test',
        purpose: 'recipe',
        minimumClearance: 10,
        parts: [
          {
            id: 'bb',
            type: 'wokwi-breadboard-half',
            top: 0,
            left: 0,
            pins: ['1t.a', '2t.a'],
          },
        ],
        wires: [
          routedWire('inside', 'bb:1t.a', 'bb:2t.a', { x: 26.8897637795, y: 50.7897637795 }, [
            ['h', 8.6],
          ]),
        ],
      }
      expect(codes(measured)).not.toContain('pin-position-mismatch')

      measured.wires[0].points[0].x += 0.001
      expect(codes(measured)).toContain('pin-position-mismatch')

      const exact = grounded([
        wire2('strict', 'mpu6050:VCC', 'uno:5V', { x: 214.411, y: 325.78 }, [
          ['v', -105.78],
          ['h', 145.589],
          ['v', -28.5],
        ]),
      ])
      expect(codes(exact)).toContain('pin-position-mismatch')
    })

    it('refuses to check a rotated part rather than using the unrotated pin table', () => {
      const layout = grounded([])
      layout.parts[1].rotate = 90
      expect(codes(layout)).toContain('unsupported-part-rotation')
    })

    it('lets a wire leave its own pin through its own board, but not cross another part', () => {
      // 5V sits 10px inboard of the Uno's bottom edge, so every attached wire
      // necessarily starts inside the body — that must not read as a violation.
      expect(
        codes(
          grounded([
            wire2('own', 'mpu6050:VCC', 'uno:5V', { x: 214.4, y: 325.78 }, [
              ['v', -105.78],
              ['h', 145.6],
              ['v', -28.5],
            ]),
          ]),
        ),
      ).not.toContain('wire-through-part')
    })
  })

  describe('keeping connected pins visible', () => {
    const uno = { id: 'uno', type: 'wokwi-arduino-uno', top: 0, left: 200, pins: ['5V', 'GND.2', 'A4', 'A5'] }
    const mpu = { id: 'mpu6050', type: 'wokwi-mpu6050', top: 320, left: 140, pins: ['VCC', 'GND', 'SDA', 'SCL'] }
    const layoutOf = (wires: ReadableLayout['wires']): ReadableLayout => ({
      version: 1,
      author: 'test',
      purpose: 'recipe',
      minimumClearance: 10,
      parts: [uno, mpu],
      wires,
    })
    const codes = (layout: ReadableLayout) => validateReadableLayout(layout).map((i) => i.code)

    it('flags a wire that lies across a pin another wire is plugged into', () => {
      // 'crosser' runs along the header at y=191.5 and passes straight over
      // A4(446,191.5), hiding where the green wire actually lands.
      const issues = codes(
        layoutOf([
          wire2('victim', 'mpu6050:SDA', 'uno:A4', { x: 185.6, y: 325.78 }, [
            ['v', -55.78],
            ['h', 260.4],
            ['v', -78.5],
          ]),
          wire2('crosser', 'mpu6050:SCL', 'uno:A5', { x: 195.2, y: 325.78 }, [
            ['v', -134.28],
            ['h', 260.3],
          ]),
        ]),
      )
      expect(issues).toContain('wire-over-connected-hole')
    })

    it('accepts a wire landing on the neighbouring pin 9.5px away', () => {
      // Header pitch is 9.5px — below minimumClearance. Treating that as a
      // violation would make the Uno's power header unwireable by construction.
      const issues = codes(
        layoutOf([
          wire2('a', 'mpu6050:VCC', 'uno:5V', { x: 214.4, y: 325.78 }, [
            ['v', -105.78],
            ['h', 145.6],
            ['v', -28.5],
          ]),
          wire2('b', 'mpu6050:GND', 'uno:GND.2', { x: 204.8, y: 325.78 }, [
            ['v', -80.78],
            ['h', 164.7],
            ['v', -53.5],
          ]),
        ]),
      )
      expect(issues).not.toContain('wire-over-connected-hole')
      expect(issues).not.toContain('wire-clearance-too-small')
    })
  })

  it('validates and compiles the chip-conformance rig, whose three chips share a breadboard I2C bus', () => {
    expect(chipConformanceLayout.purpose).toBe('recipe')
    expect(validateReadableLayout(chipConformanceLayout)).toEqual([])

    const diagram = compileReadableLayout(chipConformanceLayout)
    expect(diagram.connections).toEqual(
      expect.arrayContaining([
        ['breadboard:13t.c', 'breadboard:17t.c', 'green', ['h38.4']],
        ['breadboard:8t.c', 'breadboard:13t.d', 'green', ['h48', 'v9.6']],
        ['breadboard:17t.d', 'breadboard:27t.d', 'green', ['h96']],
        ['breadboard:12t.e', 'breadboard:18t.e', 'yellow', ['h57.6']],
        ['breadboard:7t.e', 'breadboard:12t.d', 'yellow', ['h48', 'v-9.6']],
        ['breadboard:26t.c', 'breadboard:30t.c', 'yellow', ['h38.4']],
      ]),
    )
    expect(diagram.parts.find((part) => part.id === 'bme280')).toMatchObject({
      type: 'chip-bme280',
      attrs: {
        temperatureRaw: '519888',
        pressureRaw: '415148',
        humidityRaw: '30000',
      },
    })
  })

})
