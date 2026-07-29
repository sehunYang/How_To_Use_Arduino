import type { ReadableLayout } from '../readableLayout'
import { wire } from './routing'

/** Recipe-grade layout for the INA219 current-reading Phase 2 canary. */
export const ina219CurrentLayout: ReadableLayout = {
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
      type: 'visual-ina219',
      id: 'ina219',
      top: 320,
      left: 160,
      attrs: { shuntRaw: '100', busRaw: '5000' },
      pins: ['VCC', 'GND', 'SCL', 'SDA'],
    },
  ],
  wires: [
    wire('power-ina', '5V', 'ina219:VCC', 'uno:5V', 'red', { x: 203, y: 392 }, [
      ['h', -123],
      ['v', -172],
      ['h', 280],
      ['v', -28.5],
    ], { allowCrossings: ['ground-ina', 'sda-ina', 'scl-ina'] }),
    wire('ground-ina', 'GND', 'ina219:GND', 'uno:GND.2', 'black', { x: 214, y: 392 }, [
      ['h', -154],
      ['v', -147],
      ['h', 309.5],
      ['v', -53.5],
    ], { allowCrossings: ['power-ina', 'sda-ina', 'scl-ina'] }),
    wire('sda-ina', 'SDA', 'ina219:SDA', 'uno:A4', 'green', { x: 236, y: 392 }, [
      ['h', 284],
      ['v', -97],
      ['h', -74],
      ['v', -78.5],
    ], { allowCrossings: ['power-ina', 'ground-ina'] }),
    wire('scl-ina', 'SCL', 'ina219:SCL', 'uno:A5', 'yellow', { x: 225, y: 392 }, [
      ['h', 275],
      ['v', -122],
      ['h', -44.5],
      ['v', -103.5],
    ], { allowCrossings: ['power-ina', 'ground-ina'] }),
  ],
}
