import type { ReadableLayout } from '../readableLayout'
import { wire } from './routing'

/**
 * Canonical, human-reviewed source for the pendulum recipe's Wokwi project.
 * `diagram.json` must be regenerated from this value, never edited directly.
 *
 * Every coordinate below is anchored to real Wokwi part geometry
 * (src/wokwi/partGeometry.ts) and checked by `pin-position-mismatch`, so the
 * routes validated here are the routes Wokwi draws.
 *
 * Bound to `pendulumRecipe.wiring[]` by the netlist gate in netlist.ts: every
 * conductor here is one the recipe tells a student to build. The
 * INA219/TSL2591 rig lives in chipConformanceLayout.ts precisely because it is
 * not part of a pendulum experiment.
 *
 * Routing shape — the Uno exposes 5V/GND.2 to the LEFT of A4/A5, while the
 * MPU6050 header runs SDA/SCL/GND/VCC left to right, putting its power pins to
 * the RIGHT of its signal pins. The two orderings are reversed, which forces
 * five crossings no matter how the wires are drawn (the power pair crosses
 * both signal wires, and the power wires cross each other). All five are
 * declared mutually rather than hidden. Each wire drops from its sensor pin
 * into a corridor of its own, crosses in open space between the boards, and
 * rises to its header pin — so the only sub-clearance gaps left are the header
 * pitches themselves, which no layout can widen.
 */
export const pendulumLayout: ReadableLayout = {
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
      type: 'wokwi-mpu6050',
      id: 'mpu6050',
      top: 320,
      left: 140,
      rotate: 0,
      attrs: {},
      pins: ['VCC', 'GND', 'SDA', 'SCL'],
    },
  ],
  wires: [
    // VCC (214.4, 325.78) -> 5V (360, 191.5), corridor y=220
    wire('power-mpu', '5V', 'mpu6050:VCC', 'uno:5V', 'red', { x: 214.4, y: 325.78 }, [
      ['v', -105.78],
      ['h', 145.6],
      ['v', -28.5],
    ], { allowCrossings: ['ground-mpu', 'sda-mpu', 'scl-mpu'] }),

    // GND (204.8, 325.78) -> GND.2 (369.5, 191.5), corridor y=245
    wire('ground-mpu', 'GND', 'mpu6050:GND', 'uno:GND.2', 'black', { x: 204.8, y: 325.78 }, [
      ['v', -80.78],
      ['h', 164.7],
      ['v', -53.5],
    ], { allowCrossings: ['power-mpu', 'sda-mpu', 'scl-mpu'] }),

    // SDA (185.6, 325.78) -> A4 (446, 191.5), corridor y=270
    wire('sda-mpu', 'SDA', 'mpu6050:SDA', 'uno:A4', 'green', { x: 185.6, y: 325.78 }, [
      ['v', -55.78],
      ['h', 260.4],
      ['v', -78.5],
    ], { allowCrossings: ['power-mpu', 'ground-mpu'] }),

    // SCL (195.2, 325.78) -> A5 (455.5, 191.5), corridor y=295
    wire('scl-mpu', 'SCL', 'mpu6050:SCL', 'uno:A5', 'yellow', { x: 195.2, y: 325.78 }, [
      ['v', -30.78],
      ['h', 260.3],
      ['v', -103.5],
    ], { allowCrossings: ['power-mpu', 'ground-mpu'] }),
  ],
}
