import type { Actuator } from '@/schema'

/** Seed data covering all 4 owned actuator categories (spec hardware inventory). */
export const actuators: Actuator[] = [
  {
    id: 'led',
    name: 'LED',
    category: 'passive',
    currentDrawMa: 20,
    pins: [
      { name: 'ANODE', kind: 'digital' },
      { name: 'CATHODE', kind: 'power' },
    ],
  },
  {
    id: 'buzzer',
    name: '부저',
    category: 'passive',
    currentDrawMa: 30,
    pins: [
      { name: 'SIGNAL', kind: 'digital' },
      { name: 'GND', kind: 'power' },
    ],
  },
  {
    id: 'dc-motor-driver',
    name: 'DC모터 + 모터드라이버',
    category: 'motor',
    currentDrawMa: 700,
    pins: [
      { name: 'IN1', kind: 'digital' },
      { name: 'IN2', kind: 'digital' },
      { name: 'ENA', kind: 'digital' },
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
    ],
  },
  {
    id: 'servo-sg90',
    name: 'SG90 서보모터',
    category: 'motor',
    currentDrawMa: 250,
    pins: [
      { name: 'SIGNAL', kind: 'digital' },
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
    ],
  },
  {
    id: 'relay-module',
    name: '릴레이 모듈',
    category: 'relay',
    currentDrawMa: 70,
    pins: [
      { name: 'IN', kind: 'digital' },
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
    ],
  },
  {
    id: 'dc-fan-5v',
    name: '5V 소형 팬',
    category: 'relay',
    currentDrawMa: 150,
    pins: [
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
    ],
  },
  {
    id: 'lcd1602-i2c',
    name: 'LCD1602 (I2C)',
    category: 'display',
    currentDrawMa: 20,
    pins: [
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
      { name: 'SCL', kind: 'i2c' },
      { name: 'SDA', kind: 'i2c' },
    ],
  },
]
