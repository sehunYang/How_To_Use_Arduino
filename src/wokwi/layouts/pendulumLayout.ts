import type { Point, ReadableLayout, ReadableWire } from '../readableLayout'

type Delta = readonly ['h' | 'v', number]

function routedWire(
  wire: Omit<ReadableWire, 'points'>,
  start: Point,
  deltas: Delta[],
): ReadableWire {
  const points = [{ ...start }]
  for (const [axis, distance] of deltas) {
    const previous = points.at(-1)!
    points.push({
      x: previous.x + (axis === 'h' ? distance : 0),
      y: previous.y + (axis === 'v' ? distance : 0),
    })
  }
  return { ...wire, points }
}

const wire = (
  id: string,
  net: string,
  from: string,
  to: string,
  color: string,
  start: Point,
  deltas: Delta[],
) => routedWire({ id, net, from, to, color }, start, deltas)

/**
 * Canonical, human-reviewed source for the root Wokwi project.
 * `diagram.json` must be regenerated from this value, never edited directly.
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
      type: 'wokwi-breadboard-half',
      id: 'breadboard',
      top: 20,
      left: 100,
      attrs: {},
      pins: [
        'tp.1', 'tn.1', '5t.a', '7t.a',
        'tp.5', 'tn.5', '5t.b', '7t.b',
        'tp.15', 'tn.15', '15t.b', '17t.b',
        'tp.25', 'tn.25', '25t.b', '27t.b',
        '5t.e', '15t.e', '15t.d', '25t.d',
        '7t.e', '17t.e', '17t.d', '27t.d',
      ],
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
    {
      type: 'chip-ina219',
      id: 'ina219',
      top: -170,
      left: 250,
      rotate: 0,
      attrs: { shuntRaw: '100', busRaw: '5000' },
      pins: ['VCC', 'GND', 'SDA', 'SCL'],
      bounds: { left: 250, top: -170, right: 370, bottom: -70 },
    },
    {
      type: 'chip-tsl2591',
      id: 'tsl2591',
      top: -170,
      left: 390,
      rotate: 0,
      attrs: { ch0Raw: '1234', ch1Raw: '321' },
      pins: ['VCC', 'GND', 'SDA', 'SCL'],
      bounds: { left: 390, top: -170, right: 510, bottom: -70 },
    },
  ],
  wires: [
    wire('power-uno', '5V', 'uno:5V', 'breadboard:tp.1', 'red', { x: 240, y: 360 }, [['v', -30], ['h', -130], ['v', -60]]),
    wire('ground-uno', 'GND', 'uno:GND.2', 'breadboard:tn.1', 'black', { x: 260, y: 360 }, [['v', -50], ['h', -130], ['v', -40]]),
    wire('sda-uno', 'SDA', 'uno:A4', 'breadboard:5t.a', 'green', { x: 280, y: 360 }, [['v', -70], ['h', -120], ['v', -20]]),
    wire('scl-uno', 'SCL', 'uno:A5', 'breadboard:7t.a', 'yellow', { x: 300, y: 360 }, [['v', -90], ['h', -120], ['v', -10]]),

    wire('power-mpu', '5V', 'mpu6050:VCC', 'breadboard:tp.5', 'red', { x: 120, y: -70 }, [['v', 35], ['h', -25]]),
    wire('ground-mpu', 'GND', 'mpu6050:GND', 'breadboard:tn.5', 'black', { x: 135, y: -70 }, [['v', 55], ['h', -10]]),
    wire('sda-mpu', 'SDA', 'mpu6050:SDA', 'breadboard:5t.b', 'green', { x: 165, y: -70 }, [['v', 75], ['h', 10]]),
    wire('scl-mpu', 'SCL', 'mpu6050:SCL', 'breadboard:7t.b', 'yellow', { x: 150, y: -70 }, [['v', 95], ['h', 25]]),

    wire('power-ina', '5V', 'ina219:VCC', 'breadboard:tp.15', 'red', { x: 260, y: -70 }, [['v', 35], ['h', -25]]),
    wire('ground-ina', 'GND', 'ina219:GND', 'breadboard:tn.15', 'black', { x: 275, y: -70 }, [['v', 55], ['h', -10]]),
    wire('sda-ina', 'SDA', 'ina219:SDA', 'breadboard:15t.b', 'green', { x: 305, y: -70 }, [['v', 75], ['h', 10]]),
    wire('scl-ina', 'SCL', 'ina219:SCL', 'breadboard:17t.b', 'yellow', { x: 290, y: -70 }, [['v', 95], ['h', 25]]),

    wire('power-tsl', '5V', 'tsl2591:VCC', 'breadboard:tp.25', 'red', { x: 400, y: -70 }, [['v', 35], ['h', -25]]),
    wire('ground-tsl', 'GND', 'tsl2591:GND', 'breadboard:tn.25', 'black', { x: 415, y: -70 }, [['v', 55], ['h', -10]]),
    wire('sda-tsl', 'SDA', 'tsl2591:SDA', 'breadboard:25t.b', 'green', { x: 445, y: -70 }, [['v', 75], ['h', 10]]),
    wire('scl-tsl', 'SCL', 'tsl2591:SCL', 'breadboard:27t.b', 'yellow', { x: 430, y: -70 }, [['v', 95], ['h', 25]]),

    wire('sda-bus-left', 'SDA', 'breadboard:5t.e', 'breadboard:15t.e', 'green', { x: 150, y: 140 }, [['v', -20], ['h', 90], ['v', 20], ['h', 10]]),
    wire('sda-bus-right', 'SDA', 'breadboard:15t.d', 'breadboard:25t.d', 'green', { x: 250, y: 130 }, [['h', 10], ['v', -35], ['h', 90], ['v', 35]]),
    wire('scl-bus-left', 'SCL', 'breadboard:7t.e', 'breadboard:17t.e', 'yellow', { x: 170, y: 140 }, [['v', 20], ['h', 90], ['v', -20], ['h', 10]]),
    wire('scl-bus-right', 'SCL', 'breadboard:17t.d', 'breadboard:27t.d', 'yellow', { x: 270, y: 130 }, [['h', 10], ['v', 45], ['h', 90], ['v', -45]]),
  ],
}
