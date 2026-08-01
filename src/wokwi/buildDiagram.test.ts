import { describe, it, expect } from 'vitest'
import type { Recipe, Sensor } from '@/schema'
import { sensors } from '@/data/inventory-seed/sensors'
import { pendulumRecipe } from '@/data/canary/pendulum'
import { multiTsl2591Recipe } from '@/data/canary/multiTsl2591'
import { phase5Recipes } from '@/data/phase5'
import { buildDiagram, planBreadboardWiring } from './buildDiagram'

describe('buildDiagram', () => {
  it('builds a renderable diagram for all 34 Phase 5 recipes', () => {
    for (const recipe of phase5Recipes) {
      const diagram = buildDiagram(recipe, sensors)
      expect(diagram.parts.length, recipe.id).toBeGreaterThan(1)
      const expectedConnections = planBreadboardWiring(recipe).length
      expect(diagram.connections, recipe.id).toHaveLength(expectedConnections)
      expect(diagram.parts.some((part) => part.id === 'bb'), recipe.id).toBe(true)
    }
  })

  it('produces one non-uno part for a single-sensor recipe (pendulum + MPU6050)', () => {
    const diagram = buildDiagram(pendulumRecipe, sensors)

    const nonUnoParts = diagram.parts.filter((p) => p.id !== 'uno')
    expect(nonUnoParts).toHaveLength(2)
    expect(nonUnoParts.find((part) => part.id === 'mpu6050')?.type).toBe('wokwi-mpu6050')
    expect(nonUnoParts.find((part) => part.id === 'bb')?.type).toBe('wokwi-breadboard-half')
    expect(diagram.parts.some((p) => p.id === 'uno' && p.type === 'wokwi-arduino-uno')).toBe(true)

    expect(diagram.connections).toHaveLength(6)
    expect(diagram.connections).toEqual(
      expect.arrayContaining([
        ['mpu6050:VCC', 'bb:tp.5', 'red', []],
        ['uno:5V', 'bb:tp.1', 'red', []],
        ['mpu6050:GND', 'bb:tn.5', 'black', []],
        ['uno:GND', 'bb:tn.1', 'black', []],
        ['mpu6050:SDA', 'uno:A4', 'green', []],
        ['mpu6050:SCL', 'uno:A5', 'yellow', []],
      ]),
    )
  })

  it('produces a powered breadboard circuit for two TSL2591 instances and the TCA9548A mux', () => {
    const diagram = buildDiagram(multiTsl2591Recipe, sensors)

    const nonUnoParts = diagram.parts.filter((p) => p.id !== 'uno')
    expect(nonUnoParts).toHaveLength(4)

    const partIds = nonUnoParts.map((p) => p.id).sort()
    expect(partIds).toEqual(['bb', 'tca9548a', 'tsl2591_1', 'tsl2591_2'])
    expect(nonUnoParts.find((p) => p.id === 'bb')?.type).toBe('wokwi-breadboard-half')

    for (const id of ['tsl2591_1', 'tsl2591_2']) {
      const part = nonUnoParts.find((p) => p.id === id)
      expect(part?.type).toBe('chip-tsl2591')
    }
    expect(nonUnoParts.find((p) => p.id === 'tca9548a')?.type).toBe('custom-tca9548a')

    expect(diagram.connections).toHaveLength(20)
    expect(diagram.connections).toEqual(
      expect.arrayContaining([
        ['uno:5V', 'bb:tp.1', 'red', []],
        ['uno:GND', 'bb:tn.1', 'black', []],
        ['tca9548a:VIN', 'bb:bp.8', 'red', []],
        ['tca9548a:GND', 'bb:bn.7', 'black', []],
        ['tsl2591_1:VIN', 'bb:bp.3', 'red', []],
        ['tsl2591_2:GND', 'bb:bn.24', 'black', []],
        ['tca9548a:SDA', 'uno:A4', 'green', []],
        ['tca9548a:SCL', 'uno:A5', 'yellow', []],
        ['tsl2591_1:SDA', 'bb:1t.a', 'green', []],
        ['tca9548a:SD0', 'bb:1t.b', 'green', []],
        ['tsl2591_1:SCL', 'bb:5t.a', 'yellow', []],
        ['tca9548a:SC0', 'bb:5t.b', 'yellow', []],
        ['tsl2591_2:SDA', 'bb:9t.a', 'green', []],
        ['tca9548a:SD1', 'bb:9t.b', 'green', []],
        ['tsl2591_2:SCL', 'bb:13t.a', 'yellow', []],
        ['tca9548a:SC1', 'bb:13t.b', 'yellow', []],
      ]),
    )
  })

  it('includes the sim-supported custom TSL2591 chip in the diagram output', () => {
    const tsl2591 = sensors.find((s) => s.id === 'tsl2591')
    expect(tsl2591?.wokwi.simSupported).toBe(true)

    const diagram = buildDiagram(multiTsl2591Recipe, sensors)
    const tslParts = diagram.parts.filter((p) => p.type === 'chip-tsl2591')
    expect(tslParts).toHaveLength(2)

    const tca = sensors.find((s) => s.id === 'tca9548a')
    expect(tca?.wokwi.simSupported).toBe(false)
    expect(diagram.parts.some((p) => p.type === 'custom-tca9548a')).toBe(true)
  })

  it('throws on a wiring token that resolves to no sensor, instead of emitting a dangling connection', () => {
    const typoedRecipe: Recipe = {
      ...multiTsl2591Recipe,
      wiring: multiTsl2591Recipe.wiring.map((step) => ({
        ...step,
        from: step.from.replace(/^TSL2591_2\./, 'TLS2591_2.'),
      })),
    }

    expect(typoedRecipe.wiring.some((s) => s.from.startsWith('TLS2591_2.'))).toBe(true)
    expect(() => buildDiagram(typoedRecipe, sensors)).toThrow(/TLS2591_2/)
  })

  it('throws when a component wiring endpoint names a logical pin the sensor does not declare', () => {
    const invalidPinRecipe: Recipe = {
      ...pendulumRecipe,
      wiring: pendulumRecipe.wiring.map((step) => ({
        ...step,
        from: step.from === 'MPU6050.SDA' ? 'MPU6050.NOT_A_PIN' : step.from,
      })),
    }

    expect(() => buildDiagram(invalidPinRecipe, sensors)).toThrow(
      /logical pin "NOT_A_PIN" is not declared on sensor "mpu6050"/,
    )
  })

  it('throws when a declared component pin has no Wokwi pin mapping', () => {
    const mpu6050 = sensors.find((sensor) => sensor.id === 'mpu6050')
    expect(mpu6050).toBeDefined()

    const pinMapWithoutSda = Object.fromEntries(
      Object.entries(mpu6050!.wokwi.pinMap).filter(([pin]) => pin !== 'SDA'),
    )
    const sensorWithoutSdaMapping: Sensor = {
      ...mpu6050!,
      wokwi: { ...mpu6050!.wokwi, pinMap: pinMapWithoutSda },
    }
    const sensorsWithMissingMapping = sensors.map((sensor) =>
      sensor.id === sensorWithoutSdaMapping.id ? sensorWithoutSdaMapping : sensor,
    )

    expect(() => buildDiagram(pendulumRecipe, sensorsWithMissingMapping)).toThrow(
      /logical pin "SDA" on sensor "mpu6050" has no Wokwi pin mapping/,
    )
  })

  it('generates a correct diagram for a synthetic sensor absent from the real inventory, with zero changes to buildDiagram.ts', () => {
    const fakeSensor: Sensor = {
      id: 'fake-sensor-11',
      name: 'Fake Sensor 11',
      interface: 'digital',
      addressing: { mode: 'none' },
      pins: [
        { name: 'VCC', kind: 'power' },
        { name: 'GND', kind: 'power' },
        { name: 'SIG', kind: 'digital' },
      ],
      currentDrawMa: 2,
      wokwi: { part: 'wokwi-fake-11', pinMap: { VCC: 'VCC', GND: 'GND', SIG: 'signal' }, simSupported: false },
      muxChannels: 0,
    }

    const fakeRecipe: Recipe = {
      id: 'fake-sensor-fixture',
      type: 'sensor-example',
      title: '가짜 센서 테스트',
      subject: null,
      difficulty: '초급',
      minutes: 10,
      board: 'uno-r3',
      sensors: ['fake-sensor-11'],
      actuators: [],
      coreKeywords: [],
      imageUrl: 'wiring/fake.png',
      imageWidth: 400,
      imageHeight: 300,
      wiring: [
        { from: 'FAKE-SENSOR-11.VCC', to: 'UNO.5V', color: 'red', focus: { x: 0, y: 0, w: 10, h: 10 }, text: 'VCC' },
        { from: 'FAKE-SENSOR-11.GND', to: 'UNO.GND', color: 'black', focus: { x: 0, y: 20, w: 10, h: 10 }, text: 'GND' },
        { from: 'FAKE-SENSOR-11.SIG', to: 'UNO.D2', color: 'blue', focus: { x: 0, y: 40, w: 10, h: 10 }, text: 'SIG' },
      ],
      sketch: '// @baud 9600\nvoid setup() {}\nvoid loop() {}',
      baudRate: 9600,
      tunables: [],
      body: '테스트',
      applicationGuide: '',
      troubleshooting: [],
      status: 'draft',
      reviewedOnDevice: null,
      commentReviewed: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    const diagram = buildDiagram(fakeRecipe, [...sensors, fakeSensor])

    const fakePart = diagram.parts.find((p) => p.id === 'fake-sensor-11')
    expect(fakePart?.type).toBe('wokwi-fake-11')

    expect(diagram.connections).toEqual(
      expect.arrayContaining([
        ['fake-sensor-11:VCC', 'bb:tp.5', 'red', []],
        ['uno:5V', 'bb:tp.1', 'red', []],
        ['fake-sensor-11:GND', 'bb:tn.5', 'black', []],
        ['uno:GND', 'bb:tn.1', 'black', []],
        ['fake-sensor-11:signal', 'uno:2', 'blue', []],
      ]),
    )
  })
})
