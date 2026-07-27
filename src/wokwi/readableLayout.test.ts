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

  it('validates and compiles the production pendulum layout, which wires the sensor straight to the board', () => {
    expect(pendulumLayout.parts.every((part) => part.bounds !== undefined)).toBe(true)
    expect(validateReadableLayout(pendulumLayout)).toEqual([])

    // The MPU6050 breaks out SCL before SDA while the Uno exposes A4 before A5,
    // so those two wires must cross; every other pair stays crossing-free by
    // turning at its own horizontal level.
    const diagram = compileReadableLayout(pendulumLayout)
    expect(diagram.connections).toEqual([
      ['mpu6050:VCC', 'uno:5V', 'red', ['v260', 'h120', 'v170']],
      ['mpu6050:GND', 'uno:GND.2', 'black', ['v230', 'h125', 'v200']],
      ['mpu6050:SCL', 'uno:A5', 'yellow', ['v200', 'h150', 'v230']],
      ['mpu6050:SDA', 'uno:A4', 'green', ['v170', 'h115', 'v260']],
    ])
  })

  it('validates and compiles the chip-conformance rig, whose two chips share a breadboard I2C bus', () => {
    expect(validateReadableLayout(chipConformanceLayout)).toEqual([])

    const diagram = compileReadableLayout(chipConformanceLayout)
    expect(diagram.connections).toEqual(
      expect.arrayContaining([
        ['breadboard:5t.e', 'breadboard:15t.e', 'green', ['v-20', 'h90', 'v20', 'h10']],
        ['breadboard:15t.d', 'breadboard:25t.d', 'green', ['h10', 'v-35', 'h90', 'v35']],
        ['breadboard:7t.e', 'breadboard:17t.e', 'yellow', ['v20', 'h90', 'v-20', 'h10']],
        ['breadboard:17t.d', 'breadboard:27t.d', 'yellow', ['h10', 'v45', 'h90', 'v-45']],
      ]),
    )
  })
})
