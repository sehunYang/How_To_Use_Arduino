import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  GEOMETRY_UNAVAILABLE,
  customChipGeometry,
  geometryFor,
} from './partGeometry'

const pxPerMm = 96 / 25.4

describe('Wokwi part geometry', () => {
  it('generates the measured half-breadboard grid from the published formulas', () => {
    const geometry = geometryFor('wokwi-breadboard-half')!
    const byName = new Map(geometry.pins.map((pin) => [pin.name, pin]))

    expect(geometry).toMatchObject({
      source: 'measured',
      tolerance: 0.5,
      width: 87 * pxPerMm,
      height: 55 * pxPerMm,
    })
    expect(geometry.pins).toHaveLength(400)
    expect(byName.get('1t.a')).toEqual({ name: '1t.a', x: 26.3897637795, y: 50.7897637795 })
    expect(byName.get('30t.e')).toEqual({
      name: '30t.e',
      x: 26.3897637795 + 9.6 * 29,
      y: 50.7897637795 + 9.6 * 4,
    })
    expect(byName.get('1b.f')).toEqual({ name: '1b.f', x: 26.3897637795, y: 118.7897637795 })
    expect(byName.get('tp.25')).toEqual({
      name: 'tp.25',
      x: 34.8897637795 + 9.6 * 24 + 9.6 * 4,
      y: 12.6897637795,
    })
    expect(byName.get('bn.25')).toEqual({
      name: 'bn.25',
      x: 34.8897637795 + 9.6 * 24 + 9.6 * 4,
      y: 196.0897637795,
    })
    expect(new Set(geometry.pins.map((pin) => pin.name)).size).toBe(geometry.pins.length)
  })

  it('generalizes custom-chip pin placement from four pins to six pins', () => {
    const four = customChipGeometry(['VCC', 'GND', 'SCL', 'SDA'], { width: 112, height: 73 })
    expect(four).toMatchObject({
      source: 'measured',
      tolerance: 0.5,
      width: 112 + 2 * pxPerMm,
      height: 2 * 9.6 + 2 * pxPerMm + 73,
    })
    expect(four.pins).toEqual([
      { name: 'VCC', x: 4.8, y: 2.27 * pxPerMm },
      { name: 'GND', x: 4.8, y: 2.27 * pxPerMm + 9.6 },
      { name: 'SCL', x: four.width - 4.8, y: 2.27 * pxPerMm + 9.6 },
      { name: 'SDA', x: four.width - 4.8, y: 2.27 * pxPerMm },
    ])

    const six = customChipGeometry(['L1', 'L2', 'L3', 'R3', 'R2', 'R1'], {
      width: 40,
      height: 20,
    })
    expect(six.height).toBe(3 * 9.6 + 2 * pxPerMm + 20)
    expect(six.pins.map(({ name, x, y }) => ({ name, x, y }))).toEqual([
      { name: 'L1', x: 4.8, y: 2.27 * pxPerMm },
      { name: 'L2', x: 4.8, y: 2.27 * pxPerMm + 9.6 },
      { name: 'L3', x: 4.8, y: 2.27 * pxPerMm + 19.2 },
      { name: 'R3', x: six.width - 4.8, y: 2.27 * pxPerMm + 19.2 },
      { name: 'R2', x: six.width - 4.8, y: 2.27 * pxPerMm + 9.6 },
      { name: 'R1', x: six.width - 4.8, y: 2.27 * pxPerMm },
    ])
  })

  it('registers both custom chips and keeps only genuinely unavailable breadboards listed', () => {
    expect(geometryFor('chip-ina219')).toEqual(geometryFor('chip-tsl2591'))
    expect(geometryFor('chip-ina219')?.pins.map((pin) => pin.name)).toEqual([
      'VCC',
      'GND',
      'SCL',
      'SDA',
    ])
    expect(GEOMETRY_UNAVAILABLE).not.toHaveProperty('wokwi-breadboard-half')
    expect(GEOMETRY_UNAVAILABLE).not.toHaveProperty('chip-ina219')
    expect(GEOMETRY_UNAVAILABLE).not.toHaveProperty('chip-tsl2591')
    expect(GEOMETRY_UNAVAILABLE).toHaveProperty('wokwi-breadboard')
    expect(GEOMETRY_UNAVAILABLE).toHaveProperty('wokwi-breadboard-mini')
  })

  it('keeps custom-chip geometry synchronized with both chip definitions', () => {
    for (const chip of ['ina219', 'tsl2591']) {
      const definition = JSON.parse(
        readFileSync(new URL(`../../chips/${chip}.chip.json`, import.meta.url), 'utf8'),
      ) as { pins: string[]; display: { width: number; height: number } }
      expect(geometryFor(`chip-${chip}`)).toEqual(
        customChipGeometry(definition.pins, definition.display),
      )
    }
  })

  it('marks transcribed wokwi-elements geometry with its strict source tolerance', () => {
    expect(geometryFor('wokwi-arduino-uno')).toMatchObject({
      source: 'wokwi-elements',
      tolerance: 0.01,
    })
    expect(geometryFor('wokwi-mpu6050')).toMatchObject({
      source: 'wokwi-elements',
      tolerance: 0.01,
    })
  })
})
