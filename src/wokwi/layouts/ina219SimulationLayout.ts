import type { ReadableLayout } from '../readableLayout'
import { wire } from './routing'

/** Wokwi-only INA219 layout using the custom-chip pin geometry. */
export const ina219SimulationLayout: ReadableLayout = {
  version: 1,
  author: 'sehunYang',
  purpose: 'recipe',
  minimumClearance: 10,
  parts: [
    {
      type: 'wokwi-arduino-uno',
      id: 'uno',
      top: 0,
      left: 200,
      attrs: {},
      pins: ['5V', 'GND.2', 'A4', 'A5'],
    },
    {
      type: 'chip-ina219',
      id: 'ina219',
      top: 320,
      left: 160,
      attrs: { shuntRaw: '100', busRaw: '5000' },
      pins: ['VCC', 'GND', 'SCL', 'SDA'],
    },
  ],
  wires: [
    wire('power-ina', '5V', 'ina219:VCC', 'uno:5V', 'red', { x: 164.8, y: 328.5797637795 }, [
      ['h', -40], ['v', -108.5797637795], ['h', 235.2], ['v', -28.5],
    ], { allowCrossings: ['ground-ina', 'sda-ina', 'scl-ina'] }),
    wire('ground-ina', 'GND', 'ina219:GND', 'uno:GND.2', 'black', { x: 164.8, y: 338.1797637795 }, [
      ['h', -60], ['v', -93.1797637795], ['h', 264.7], ['v', -53.5],
    ], { allowCrossings: ['power-ina', 'sda-ina', 'scl-ina'] }),
    wire('sda-ina', 'SDA', 'ina219:SDA', 'uno:A4', 'green', { x: 274.7590551181, y: 328.5795275591 }, [
      ['h', 30], ['v', -58.5795275591], ['h', 141.2409448819], ['v', -78.5],
    ], { allowCrossings: ['power-ina', 'ground-ina'] }),
    wire('scl-ina', 'SCL', 'ina219:SCL', 'uno:A5', 'yellow', { x: 274.7590551181, y: 338.1795275591 }, [
      ['h', 50], ['v', -43.1795275591], ['h', 130.7409448819], ['v', -103.5],
    ], { allowCrossings: ['power-ina', 'ground-ina'] }),
  ],
}
