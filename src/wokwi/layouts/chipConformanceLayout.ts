import type { ReadableLayout } from '../readableLayout'
import { wire } from './routing'

/**
 * Strict Wokwi layout for the custom-chip conformance rig.
 *
 * The rig is not teaching content, but it uses the same recipe-grade geometry
 * gate as photographed circuits. Its half-breadboard and custom-chip
 * coordinates come from the measured formulas in partGeometry.ts, so the
 * generated diagram cannot drift away from the pins Wokwi actually renders.
 */
export const chipConformanceLayout: ReadableLayout = {
  version: 1,
  author: 'sehunYang',
  purpose: 'recipe',
  minimumClearance: 10,
  parts: [
    {
      type: 'wokwi-arduino-uno',
      id: 'uno',
      top: 500,
      left: 149.29,
      attrs: {},
      pins: ['5V', 'GND.2', 'A4', 'A5'],
    },
    {
      type: 'wokwi-breadboard-half',
      id: 'breadboard',
      top: 100,
      left: 100,
      attrs: {},
      pins: [
        'tp.1', 'tn.2', '29t.e', '30t.e',
        'tp.4', 'tn.5', '13t.b', '12t.b',
        'tp.13', 'tn.12', '27t.b', '24t.b',
        'tp.3', 'tn.18', '8t.b', '7t.b',
        '8t.c', '7t.e', '13t.d', '12t.d',
        '13t.c', '17t.c', '17t.d', '27t.d',
        '27t.e', '28t.e', '28t.b', '29t.b',
        '12t.e', '18t.e', '18t.c', '24t.c',
        '24t.e', '26t.e', '26t.c', '30t.c',
      ],
    },
    {
      type: 'chip-bme280',
      id: 'bme280',
      top: -120,
      left: -90,
      rotate: 0,
      attrs: {
        temperatureRaw: '519888',
        pressureRaw: '415148',
        humidityRaw: '30000',
      },
      pins: ['VCC', 'GND', 'SDA', 'SCL'],
    },
    {
      type: 'chip-ina219',
      id: 'ina219',
      top: -120,
      left: 120,
      rotate: 0,
      attrs: { shuntRaw: '100', busRaw: '5000' },
      pins: ['VCC', 'GND', 'SDA', 'SCL'],
    },
    {
      type: 'chip-tsl2591',
      id: 'tsl2591',
      top: -120,
      left: 329.2,
      rotate: 0,
      attrs: { ch0Raw: '1234', ch1Raw: '321' },
      pins: ['VCC', 'GND', 'SDA', 'SCL'],
    },
  ],
  wires: [
    wire('power-uno', '5V', 'uno:5V', 'breadboard:tp.1', 'red', { x: 309.29, y: 691.5 }, [
      ['v', -291.5],
      ['h', -174.4],
      ['v', -287.31],
    ]),
    wire('ground-uno', 'GND', 'uno:GND.2', 'breadboard:tn.2', 'black', { x: 318.79, y: 691.5 }, [
      ['v', -311.5],
      ['h', -174.3],
      ['v', -257.71],
    ]),
    wire('sda-uno', 'SDA', 'uno:A4', 'breadboard:29t.e', 'green', { x: 395.29, y: 691.5 }, [
      ['v', -502.31],
    ]),
    wire('scl-uno', 'SCL', 'uno:A5', 'breadboard:30t.e', 'yellow', { x: 404.79, y: 691.5 }, [
      ['v', -502.31],
    ]),

    wire('power-bme', '5V', 'bme280:VCC', 'breadboard:tp.3', 'red', { x: -85.2, y: -111.42 }, [
      ['h', -34.8],
      ['v', 147.42],
      ['h', 274.09],
      ['v', 76.69],
    ], { allowCrossings: ['ground-bme', 'sda-bme', 'scl-bme', 'power-ina', 'ground-ina'] }),
    wire('ground-bme', 'GND', 'bme280:GND', 'breadboard:tn.18', 'black', { x: -85.2, y: -101.82 }, [
      ['h', -24.8],
      ['v', 196.82],
      ['h', 436.89],
      ['v', 27.29],
    ], { allowCrossings: ['power-bme', 'sda-bme', 'scl-bme', 'power-ina', 'ground-ina', 'sda-ina', 'scl-ina', 'power-tsl', 'ground-tsl', 'sda-tsl', 'scl-tsl'] }),
    wire('sda-bme', 'SDA', 'bme280:SDA', 'breadboard:8t.b', 'green', { x: 24.76, y: -111.42 }, [
      ['h', 34.8],
      ['v', 195.42],
      ['h', 134.03],
      ['v', 76.39],
    ], { allowCrossings: ['power-bme', 'ground-bme', 'scl-bme', 'power-ina', 'ground-ina'] }),
    wire('scl-bme', 'SCL', 'bme280:SCL', 'breadboard:7t.b', 'yellow', { x: 24.76, y: -101.82 }, [
      ['h', 24.8],
      ['v', 173.82],
      ['h', 134.43],
      ['v', 88.39],
    ], { allowCrossings: ['power-bme', 'ground-bme', 'sda-bme', 'power-ina', 'ground-ina'] }),

    wire('power-ina', '5V', 'ina219:VCC', 'breadboard:tp.4', 'red', { x: 124.8, y: -111.42 }, [
      ['h', -34.8],
      ['v', 123.42],
      ['h', 73.69],
      ['v', 100.69],
    ], { allowCrossings: ['power-bme', 'ground-bme', 'sda-bme', 'scl-bme'] }),
    wire('ground-ina', 'GND', 'ina219:GND', 'breadboard:tn.5', 'black', { x: 124.8, y: -101.82 }, [
      ['h', -24.8],
      ['v', 101.82],
      ['h', 73.29],
      ['v', 122.29],
    ], { allowCrossings: ['power-bme', 'ground-bme', 'sda-bme', 'scl-bme'] }),
    wire('sda-ina', 'SDA', 'ina219:SDA', 'breadboard:13t.b', 'green', { x: 234.76, y: -111.42 }, [
      ['h', 34.8],
      ['v', 147.42],
      ['h', -27.97],
      ['v', 124.39],
    ], { allowCrossings: ['ground-bme'] }),
    wire('scl-ina', 'SCL', 'ina219:SCL', 'breadboard:12t.b', 'yellow', { x: 234.76, y: -101.82 }, [
      ['h', 24.8],
      ['v', 125.82],
      ['h', -27.57],
      ['v', 136.39],
    ], { allowCrossings: ['ground-bme'] }),

    wire('power-tsl', '5V', 'tsl2591:VCC', 'breadboard:tp.13', 'red', { x: 334, y: -111.42 }, [
      ['h', -34.8],
      ['v', 171.42],
      ['h', -29.91],
      ['v', 52.69],
    ], { allowCrossings: ['ground-tsl', 'ground-bme'] }),
    wire('ground-tsl', 'GND', 'tsl2591:GND', 'breadboard:tn.12', 'black', { x: 334, y: -101.82 }, [
      ['h', -24.8],
      ['v', 149.82],
      ['h', -49.51],
      ['v', 74.29],
    ], { allowCrossings: ['power-tsl', 'ground-bme'] }),
    wire('sda-tsl', 'SDA', 'tsl2591:SDA', 'breadboard:27t.b', 'green', { x: 443.96, y: -111.42 }, [
      ['h', 34.8],
      ['v', 195.42],
      ['h', -102.77],
      ['v', 76.39],
    ], { allowCrossings: ['ground-bme'] }),
    wire('scl-tsl', 'SCL', 'tsl2591:SCL', 'breadboard:24t.b', 'yellow', { x: 443.96, y: -101.82 }, [
      ['h', 24.8],
      ['v', 173.82],
      ['h', -121.57],
      ['v', 88.39],
    ], { allowCrossings: ['ground-bme'] }),

    wire('sda-bus-1', 'SDA', 'breadboard:13t.c', 'breadboard:17t.c', 'green', { x: 241.59, y: 169.99 }, [
      ['h', 38.4],
    ], { allowCrossings: ['sda-bus-bme'] }),
    wire('sda-bus-bme', 'SDA', 'breadboard:8t.c', 'breadboard:13t.d', 'green', { x: 193.59, y: 169.99 }, [
      ['h', 48],
      ['v', 9.6],
    ], { allowCrossings: ['sda-bus-1'] }),
    wire('sda-bus-2', 'SDA', 'breadboard:17t.d', 'breadboard:27t.d', 'green', { x: 279.99, y: 179.59 }, [
      ['h', 96],
    ]),
    wire('sda-bus-3', 'SDA', 'breadboard:27t.e', 'breadboard:28t.e', 'green', { x: 375.99, y: 189.19 }, [
      ['h', 9.6],
    ]),
    wire('sda-bus-4', 'SDA', 'breadboard:28t.b', 'breadboard:29t.b', 'green', { x: 385.59, y: 160.39 }, [
      ['h', 9.6],
    ]),
    wire('scl-bus-1', 'SCL', 'breadboard:12t.e', 'breadboard:18t.e', 'yellow', { x: 231.99, y: 189.19 }, [
      ['h', 57.6],
    ], { allowCrossings: ['scl-bus-bme'] }),
    wire('scl-bus-bme', 'SCL', 'breadboard:7t.e', 'breadboard:12t.d', 'yellow', { x: 183.99, y: 189.19 }, [
      ['h', 48],
      ['v', -9.6],
    ], { allowCrossings: ['scl-bus-1'] }),
    wire('scl-bus-2', 'SCL', 'breadboard:18t.c', 'breadboard:24t.c', 'yellow', { x: 289.59, y: 169.99 }, [
      ['h', 57.6],
    ]),
    wire('scl-bus-3', 'SCL', 'breadboard:24t.e', 'breadboard:26t.e', 'yellow', { x: 347.19, y: 189.19 }, [
      ['h', 19.2],
    ]),
    wire('scl-bus-4', 'SCL', 'breadboard:26t.c', 'breadboard:30t.c', 'yellow', { x: 366.39, y: 169.99 }, [
      ['h', 38.4],
    ]),
  ],
}
