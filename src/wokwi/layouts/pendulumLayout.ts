import type { ReadableLayout } from '../readableLayout'
import { wire } from './routing'

/**
 * Canonical, human-reviewed source for the pendulum recipe's Wokwi project.
 * `diagram.json` must be regenerated from this value, never edited directly.
 *
 * This layout is bound to `pendulumRecipe.wiring[]` by the netlist gate in
 * netlist.ts: every conductor here must be one the recipe tells a student to
 * build, and vice versa. That is why the INA219/TSL2591 custom-chip rig lives
 * in chipConformanceLayout.ts instead of here — those chips are a verification
 * fixture, not part of a pendulum experiment, and wiring them into this
 * diagram would make the recipe's SimBadge attest to a circuit the recipe
 * never describes.
 *
 * Routing note: the MPU6050 breaks out its pins in VCC/GND/SCL/SDA order while
 * the Uno exposes A4=SDA before A5=SCL, so those two wires must cross. That
 * crossing is physically unavoidable rather than a routing mistake, so both
 * wires declare it mutually via `allowCrossings`. Each wire turns at its own
 * horizontal level, which keeps every other pair crossing-free.
 */
export const pendulumLayout: ReadableLayout = {
  version: 1,
  author: 'sehunYang',
  minimumClearance: 10,
  parts: [
    {
      type: 'wokwi-arduino-uno',
      id: 'uno',
      top: 360,
      left: 180,
      attrs: {},
      pins: ['5V', 'GND.2', 'A4', 'A5'],
      bounds: { left: 180, top: 360, right: 430, bottom: 530 },
    },
    {
      type: 'wokwi-mpu6050',
      id: 'mpu6050',
      top: -170,
      left: 110,
      rotate: 0,
      attrs: {},
      pins: ['VCC', 'GND', 'SDA', 'SCL'],
      bounds: { left: 110, top: -170, right: 230, bottom: -70 },
    },
  ],
  wires: [
    wire('power-mpu', '5V', 'mpu6050:VCC', 'uno:5V', 'red', { x: 120, y: -70 }, [
      ['v', 260],
      ['h', 120],
      ['v', 170],
    ]),
    wire('ground-mpu', 'GND', 'mpu6050:GND', 'uno:GND.2', 'black', { x: 135, y: -70 }, [
      ['v', 230],
      ['h', 125],
      ['v', 200],
    ]),
    wire('scl-mpu', 'SCL', 'mpu6050:SCL', 'uno:A5', 'yellow', { x: 150, y: -70 }, [
      ['v', 200],
      ['h', 150],
      ['v', 230],
    ], { allowCrossings: ['sda-mpu'] }),
    wire('sda-mpu', 'SDA', 'mpu6050:SDA', 'uno:A4', 'green', { x: 165, y: -70 }, [
      ['v', 170],
      ['h', 115],
      ['v', 260],
    ], { allowCrossings: ['scl-mpu'] }),
  ],
}
