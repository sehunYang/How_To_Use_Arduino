import type { ReadableLayout } from '../readableLayout'
import { wire } from './routing'

const crossings = [
  'uno-power', 'uno-ground', 'rail-power', 'rail-ground',
  'mux-power', 'mux-ground', 'tsl1-power', 'tsl1-ground',
  'tsl2-power', 'tsl2-ground', 'mux-sda', 'mux-scl',
  'tsl1-sda', 'tsl1-scl', 'tsl2-sda', 'tsl2-scl',
]

const crossingAllowance = (id: string) => ({
  allowCrossings: crossings.filter((candidate) => candidate !== id),
})

export const multiTsl2591Layout: ReadableLayout = {
  version: 1,
  author: 'sehunYang',
  purpose: 'recipe',
  minimumClearance: 8,
  parts: [
    {
      type: 'wokwi-arduino-uno',
      id: 'uno',
      top: 0,
      left: 300,
      attrs: {},
      pins: ['5V', 'GND.2', 'A4', 'A5'],
    },
    {
      type: 'wokwi-breadboard-half',
      id: 'bb',
      top: 300,
      left: 270,
      attrs: {},
      pins: ['tp.1', 'tn.2', 'tp.25', 'tn.25', 'bp.25', 'bn.25', 'bp.3', 'bn.4', 'bp.8', 'bn.7', 'bp.23', 'bn.24'],
    },
    {
      type: 'visual-tca9548a',
      id: 'tca9548a',
      top: 600,
      left: 325,
      attrs: {},
      pins: ['VCC', 'GND', 'SCL', 'SDA', 'SC0', 'SD0', 'SC1', 'SD1'],
    },
    {
      type: 'visual-tsl2591',
      id: 'tsl2591_1',
      top: 590,
      left: 40,
      attrs: {},
      pins: ['VCC', 'GND', 'SCL', 'SDA'],
    },
    {
      type: 'visual-tsl2591',
      id: 'tsl2591_2',
      top: 590,
      left: 700,
      attrs: {},
      pins: ['VCC', 'GND', 'SCL', 'SDA'],
    },
  ],
  wires: [
    wire('uno-power', '5V', 'uno:5V', 'bb:tp.1', 'red', { x: 460, y: 191.5 }, [
      ['v', 48.5], ['h', -155.1102362205], ['v', 72.6897637795],
    ], crossingAllowance('uno-power')),
    wire('uno-ground', 'GND', 'uno:GND.2', 'bb:tn.2', 'black', { x: 469.5, y: 191.5 }, [
      ['v', 68.5], ['h', -155.0102362205], ['v', 62.2897637795],
    ], crossingAllowance('uno-ground')),
    wire('rail-power', '5V', 'bb:tp.25', 'bb:bp.25', 'red', { x: 573.6897637795, y: 312.6897637795 }, [
      ['h', 65], ['v', 173.8], ['h', -65],
    ], crossingAllowance('rail-power')),
    wire('rail-ground', 'GND', 'bb:tn.25', 'bb:bn.25', 'black', { x: 573.6897637795, y: 322.2897637795 }, [
      ['h', 80], ['v', 173.8], ['h', -80],
    ], crossingAllowance('rail-ground')),
    wire('mux-power', '5V', 'tca9548a:VCC', 'bb:bp.8', 'red', { x: 417, y: 600 }, [
      ['v', -70], ['h', -35.3102362205], ['v', -43.5102362205],
    ], crossingAllowance('mux-power')),
    wire('mux-ground', 'GND', 'tca9548a:GND', 'bb:bn.7', 'black', { x: 429, y: 600 }, [
      ['v', -40], ['h', -56.9102362205], ['v', -63.9102362205],
    ], crossingAllowance('mux-ground')),
    wire('tsl1-power', '5V', 'tsl2591_1:VCC', 'bb:bp.3', 'red', { x: 83, y: 662 }, [
      ['v', 28], ['h', 147], ['v', -203.5102362205], ['h', 94.0897637795],
    ], crossingAllowance('tsl1-power')),
    wire('tsl1-ground', 'GND', 'tsl2591_1:GND', 'bb:bn.4', 'black', { x: 94, y: 662 }, [
      ['v', 48], ['h', 121], ['v', -213.9102362205], ['h', 118.6897637795],
    ], crossingAllowance('tsl1-ground')),
    wire('tsl2-power', '5V', 'tsl2591_2:VCC', 'bb:bp.23', 'red', { x: 743, y: 662 }, [
      ['v', 28], ['h', -188.5102362205], ['v', -203.5102362205],
    ], crossingAllowance('tsl2-power')),
    wire('tsl2-ground', 'GND', 'tsl2591_2:GND', 'bb:bn.24', 'black', { x: 754, y: 662 }, [
      ['v', 48], ['h', -189.9102362205], ['v', -213.9102362205],
    ], crossingAllowance('tsl2-ground')),
    wire('mux-sda', 'SDA', 'tca9548a:SDA', 'uno:A4', 'green', { x: 453, y: 600 }, [
      ['v', -80], ['h', 177], ['v', -270], ['h', -84], ['v', -58.5],
    ], crossingAllowance('mux-sda')),
    wire('mux-scl', 'SCL', 'tca9548a:SCL', 'uno:A5', 'yellow', { x: 441, y: 600 }, [
      ['v', -60], ['h', 229], ['v', -270], ['h', -114.5], ['v', -78.5],
    ], crossingAllowance('mux-scl')),
    wire('tsl1-sda', 'SDA0', 'tsl2591_1:SDA', 'tca9548a:SD0', 'green', { x: 116, y: 662 }, [
      ['v', 88], ['h', 164], ['v', -93], ['h', 45],
    ], crossingAllowance('tsl1-sda')),
    wire('tsl1-scl', 'SCL0', 'tsl2591_1:SCL', 'tca9548a:SC0', 'yellow', { x: 105, y: 662 }, [
      ['v', 68], ['h', 155], ['v', -85], ['h', 65],
    ], crossingAllowance('tsl1-scl')),
    wire('tsl2-sda', 'SDA1', 'tsl2591_2:SDA', 'tca9548a:SD1', 'green', { x: 776, y: 662 }, [
      ['v', 88], ['h', -166], ['v', -93], ['h', -65],
    ], crossingAllowance('tsl2-sda')),
    wire('tsl2-scl', 'SCL1', 'tsl2591_2:SCL', 'tca9548a:SC1', 'yellow', { x: 765, y: 662 }, [
      ['v', 68], ['h', -135], ['v', -85], ['h', -85],
    ], crossingAllowance('tsl2-scl')),
  ],
}
