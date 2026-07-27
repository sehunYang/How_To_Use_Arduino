import { describe, it, expect } from 'vitest'
import type { Recipe } from '@/schema'
import { sensors } from '@/data/inventory-seed/sensors'
import { pendulumRecipe } from '@/data/canary/pendulum'
import { ina219CurrentRecipe } from '@/data/canary/ina219Current'
import type { ReadableLayout, ReadableWire } from './readableLayout'
import { validateReadableLayout } from './readableLayout'
import { pendulumLayout } from './layouts/pendulumLayout'
import { chipConformanceLayout } from './layouts/chipConformanceLayout'
import { ina219CurrentLayout } from './layouts/ina219CurrentLayout'
import {
  compareNetlists,
  layoutNetlist,
  recipeNetlist,
  validateLayoutAgainstRecipe,
} from './netlist'

/** Netlist resolution ignores geometry, so test wires only need endpoints. */
function w(id: string, net: string, from: string, to: string): ReadableWire {
  return {
    id,
    net,
    from,
    to,
    color: 'green',
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
  }
}

function layoutOf(wires: ReadableWire[]): ReadableLayout {
  return {
    version: 1,
    author: 'test',
    minimumClearance: 10,
    parts: [
      { id: 'uno', type: 'wokwi-arduino-uno', top: 0, left: 0 },
      { id: 'bb', type: 'wokwi-breadboard-half', top: 0, left: 0 },
      { id: 'mpu6050', type: 'wokwi-mpu6050', top: 0, left: 0 },
      { id: 'tsl2591', type: 'chip-tsl2591', top: 0, left: 0 },
    ],
    wires,
  }
}

const pinsOf = (layout: ReadableLayout) => layoutNetlist(layout).nets.map((net) => net.pins)
const codes = (issues: { code: string }[]) => issues.map((issue) => issue.code)

describe('breadboard conductivity', () => {
  it('treats one terminal strip column (a–e) as a single conductor', () => {
    const nets = pinsOf(
      layoutOf([
        w('a', 'SDA', 'uno:A4', 'bb:5t.a'),
        w('b', 'SDA', 'mpu6050:SDA', 'bb:5t.e'),
      ]),
    )
    expect(nets).toEqual([['mpu6050:SDA', 'uno:A4']])
  })

  it('keeps separate strip columns apart until a bus wire joins them', () => {
    const unjoined = layoutOf([
      w('a', 'SDA', 'uno:A4', 'bb:5t.a'),
      w('b', 'SDA-far', 'tsl2591:SDA', 'bb:15t.a'),
    ])
    expect(pinsOf(unjoined)).toEqual([['tsl2591:SDA'], ['uno:A4']])

    const joined = layoutOf([
      ...unjoined.wires,
      w('bus', 'SDA', 'bb:5t.e', 'bb:15t.e'),
    ])
    expect(pinsOf(joined)).toEqual([['tsl2591:SDA', 'uno:A4']])
  })

  it('treats a power rail as one conductor spanning the whole board', () => {
    const nets = pinsOf(
      layoutOf([
        w('a', '5V', 'uno:5V', 'bb:tp.1'),
        w('b', '5V', 'mpu6050:VCC', 'bb:tp.25'),
        w('c', 'GND', 'uno:GND.2', 'bb:tn.1'),
        w('d', 'GND', 'tsl2591:GND', 'bb:tn.30'),
      ]),
    )
    expect(nets).toEqual([
      ['mpu6050:VCC', 'uno:5V'],
      ['tsl2591:GND', 'uno:GND'],
    ])
  })

  it('reports a breadboard hole whose conductivity cannot be resolved', () => {
    const { issues } = layoutNetlist(layoutOf([w('a', 'SDA', 'uno:A4', 'bb:middle')]))
    expect(codes(issues)).toContain('unknown-breadboard-pin')
  })
})

describe('net label self-check', () => {
  it('flags one conductor carrying two different declared nets', () => {
    const { issues } = layoutNetlist(
      layoutOf([
        w('a', 'SDA', 'uno:A4', 'bb:5t.a'),
        w('b', 'SCL', 'mpu6050:SCL', 'bb:5t.b'),
      ]),
    )
    expect(codes(issues)).toContain('net-label-conflict')
  })

  it('flags one declared net split across conductors that never join (missing bus wire)', () => {
    const { issues } = layoutNetlist(
      layoutOf([
        w('a', 'SDA', 'uno:A4', 'bb:5t.a'),
        w('b', 'SDA', 'tsl2591:SDA', 'bb:15t.a'),
      ]),
    )
    expect(codes(issues)).toContain('net-label-split')
  })

  it('accepts coherent labels', () => {
    const { issues } = layoutNetlist(
      layoutOf([
        w('a', 'SDA', 'uno:A4', 'bb:5t.a'),
        w('b', 'SDA', 'mpu6050:SDA', 'bb:5t.b'),
      ]),
    )
    expect(issues).toEqual([])
  })
})

describe('recipe netlist', () => {
  const recipeWith = (wiring: Recipe['wiring']): Recipe => ({ ...pendulumRecipe, wiring })
  const step = (from: string, to: string): Recipe['wiring'][number] => ({
    from,
    to,
    color: 'green',
    focus: { x: 0, y: 0, w: 10, h: 10 },
    text: 'test',
  })

  it('resolves sensor pins through wokwi.pinMap, matching buildDiagram', () => {
    const nets = recipeNetlist(recipeWith([step('DS18B20.DATA', 'UNO.D2')]), sensors)
    expect(nets).toEqual([['ds18b20:DQ', 'uno:D2']])
  })

  it('treats a specific Uno ground header as the board ground net', () => {
    const nets = recipeNetlist(recipeWith([step('MPU6050.GND', 'UNO.GND')]), sensors)
    const layout = pinsOf(layoutOf([w('a', 'GND', 'mpu6050:GND', 'uno:GND.2')]))
    expect(nets).toEqual(layout)
  })

  it('merges steps that share a pin into one conductor', () => {
    const nets = recipeNetlist(
      recipeWith([step('MPU6050.VCC', 'UNO.5V'), step('TSL2591.VCC', 'UNO.5V')]),
      sensors,
    )
    expect(nets).toEqual([['mpu6050:VCC', 'tsl2591:VCC', 'uno:5V']])
  })
})

describe('layout ↔ recipe gate', () => {
  it('passes when the layout builds exactly the recipe’s circuit', () => {
    expect(validateLayoutAgainstRecipe(pendulumLayout, pendulumRecipe, sensors)).toEqual([])
  })

  it('binds the INA219 L3 canary layout to its recipe wiring', () => {
    expect(
      validateLayoutAgainstRecipe(ina219CurrentLayout, ina219CurrentRecipe, sensors),
    ).toEqual([])
  })

  it('catches a sensor wired into the simulated bus that the recipe never declares', () => {
    const extra: ReadableLayout = {
      ...pendulumLayout,
      parts: [...pendulumLayout.parts, { id: 'tsl2591', type: 'chip-tsl2591', top: 0, left: 0 }],
      wires: [...pendulumLayout.wires, w('extra', 'SDA', 'tsl2591:SDA', 'uno:A4')],
    }
    const issues = validateLayoutAgainstRecipe(extra, pendulumRecipe, sensors)
    expect(codes(issues)).toContain('netlist-mismatch')
    expect(issues.some((issue) => issue.message.includes('tsl2591:SDA'))).toBe(true)
  })

  it('catches a wire moved to the wrong breadboard row — geometry alone cannot', () => {
    const rightRow = layoutOf([
      w('uno-sda', 'SDA', 'uno:A4', 'bb:5t.a'),
      w('mpu-sda', 'SDA', 'mpu6050:SDA', 'bb:5t.b'),
    ])
    // Same wire count, same parts, still perfectly orthogonal — only the hole changed.
    const wrongRow = layoutOf([
      w('uno-sda', 'SDA', 'uno:A4', 'bb:5t.a'),
      w('mpu-sda', 'SDA', 'mpu6050:SDA', 'bb:6t.b'),
    ])
    const recipe = { ...pendulumRecipe, wiring: [pendulumRecipe.wiring[2]] } as Recipe

    // Identical geometric verdicts: the strict layout rules see no difference
    // between the correct hole and the wrong one.
    expect(codes(validateReadableLayout(wrongRow))).toEqual(
      codes(validateReadableLayout(rightRow)),
    )
    expect(compareNetlists(layoutNetlist(rightRow).nets, recipeNetlist(recipe, sensors))).toEqual([])
    expect(
      codes(compareNetlists(layoutNetlist(wrongRow).nets, recipeNetlist(recipe, sensors))),
    ).toContain('netlist-mismatch')
  })
})

describe('chip conformance rig (strict layout with no teaching recipe)', () => {
  it('puts both custom chips on one shared I2C bus with the Uno', () => {
    const { nets, issues } = layoutNetlist(chipConformanceLayout)
    expect(issues).toEqual([])
    expect(nets.map((net) => [net.labels, net.pins])).toEqual([
      [['GND'], ['ina219:GND', 'tsl2591:GND', 'uno:GND']],
      [['SCL'], ['ina219:SCL', 'tsl2591:SCL', 'uno:A5']],
      [['SDA'], ['ina219:SDA', 'tsl2591:SDA', 'uno:A4']],
      [['5V'], ['ina219:VCC', 'tsl2591:VCC', 'uno:5V']],
    ])
  })

  it('does not smuggle the pendulum recipe’s MPU6050 into the rig', () => {
    const parts = chipConformanceLayout.parts.map((part) => part.id)
    expect(parts).not.toContain('mpu6050')
  })
})
