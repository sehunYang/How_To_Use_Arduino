import type { Sensor } from '@/schema'

/**
 * Seed data for the 10 owned sensors (spec hardware inventory).
 * `wokwi.simSupported` reflects CURRENT state: true only for sensors with
 * a native Wokwi part, an approved analog stand-in, or an audited in-repo
 * custom chip. INA219, TSL2591, and BME280 use audited in-repo chips.
 * TCA9548A has no path to simulation and stays false permanently.
 */
export const sensors: Sensor[] = [
  {
    id: 'ina219',
    name: 'INA219',
    interface: 'i2c',
    addressing: {
      mode: 'strapped',
      addresses: ['0x40', '0x41', '0x44', '0x45'],
      strapPins: ['A0', 'A1'],
      maxOnBus: 4,
    },
    pins: [
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
      { name: 'SCL', kind: 'i2c' },
      { name: 'SDA', kind: 'i2c' },
    ],
    currentDrawMa: 1,
    wokwi: { part: 'chip-ina219', pinMap: { VCC: 'VCC', GND: 'GND', SCL: 'SCL', SDA: 'SDA' }, simSupported: true },
    muxChannels: 0,
  },
  {
    id: 'tsl2591',
    name: 'TSL2591',
    interface: 'i2c',
    addressing: { mode: 'fixed', addresses: ['0x29'], maxOnBus: 1 },
    pins: [
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
      { name: 'SCL', kind: 'i2c' },
      { name: 'SDA', kind: 'i2c' },
    ],
    currentDrawMa: 0.4,
    wokwi: { part: 'chip-tsl2591', pinMap: { VCC: 'VCC', GND: 'GND', SCL: 'SCL', SDA: 'SDA' }, simSupported: true },
    muxChannels: 0,
  },
  {
    id: 'mpu6050',
    name: 'MPU6050',
    interface: 'i2c',
    addressing: { mode: 'strapped', addresses: ['0x68', '0x69'], strapPins: ['AD0'], maxOnBus: 2 },
    pins: [
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
      { name: 'SCL', kind: 'i2c' },
      { name: 'SDA', kind: 'i2c' },
    ],
    currentDrawMa: 3.9,
    wokwi: { part: 'wokwi-mpu6050', pinMap: { VCC: 'VCC', GND: 'GND', SCL: 'SCL', SDA: 'SDA' }, simSupported: true },
    muxChannels: 0,
  },
  {
    id: 'bme280',
    name: 'BME280',
    interface: 'i2c',
    addressing: { mode: 'strapped', addresses: ['0x76', '0x77'], strapPins: ['SDO'], maxOnBus: 2 },
    pins: [
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
      { name: 'SCL', kind: 'i2c' },
      { name: 'SDA', kind: 'i2c' },
    ],
    currentDrawMa: 0.36,
    wokwi: { part: 'chip-bme280', pinMap: { VCC: 'VCC', GND: 'GND', SCL: 'SCL', SDA: 'SDA' }, simSupported: true },
    muxChannels: 0,
  },
  {
    id: 'ds18b20',
    name: 'DS18B20',
    interface: 'onewire',
    addressing: { mode: 'onewire', maxOnBus: 255 },
    pins: [
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
      { name: 'DATA', kind: 'digital' },
    ],
    currentDrawMa: 1.5,
    wokwi: { part: 'wokwi-ds18b20', pinMap: { VCC: 'VCC', GND: 'GND', DATA: 'DQ' }, simSupported: true },
    muxChannels: 0,
  },
  {
    id: 'tca9548a',
    name: 'TCA9548A',
    interface: 'i2c',
    addressing: {
      mode: 'strapped',
      addresses: ['0x70', '0x71', '0x72', '0x73', '0x74', '0x75', '0x76', '0x77'],
      strapPins: ['A0', 'A1', 'A2'],
      maxOnBus: 8,
    },
    pins: [
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
      { name: 'SCL', kind: 'i2c' },
      { name: 'SDA', kind: 'i2c' },
    ],
    currentDrawMa: 1,
    wokwi: { part: 'custom-tca9548a', pinMap: { VCC: 'VCC', GND: 'GND', SCL: 'SCL', SDA: 'SDA' }, simSupported: false },
    muxChannels: 8,
  },
  {
    id: 'cds',
    name: 'CDS 조도센서',
    interface: 'analog',
    addressing: { mode: 'none' },
    pins: [
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
      { name: 'AO', kind: 'analog' },
    ],
    currentDrawMa: 5,
    wokwi: { part: 'wokwi-photoresistor-sensor', pinMap: { VCC: 'VCC', GND: 'GND', AO: 'AO' }, simSupported: true },
    muxChannels: 0,
  },
  {
    id: 'hc-sr501',
    name: 'HC-SR501',
    interface: 'digital',
    addressing: { mode: 'none' },
    pins: [
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
      { name: 'OUT', kind: 'digital' },
    ],
    currentDrawMa: 65,
    wokwi: { part: 'wokwi-pir-motion-sensor', pinMap: { VCC: 'VCC', GND: 'GND', OUT: 'OUT' }, simSupported: true },
    muxChannels: 0,
  },
  {
    id: 'hc-sr04',
    name: 'HC-SR04',
    interface: 'digital',
    addressing: { mode: 'none' },
    pins: [
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
      { name: 'TRIG', kind: 'digital' },
      { name: 'ECHO', kind: 'digital' },
    ],
    currentDrawMa: 15,
    wokwi: {
      part: 'wokwi-hc-sr04',
      pinMap: { VCC: 'VCC', GND: 'GND', TRIG: 'TRIG', ECHO: 'ECHO' },
      simSupported: true,
    },
    muxChannels: 0,
  },
  {
    id: 'hbe0704',
    name: 'HBE0704 (홀 센서)',
    interface: 'analog',
    addressing: { mode: 'none' },
    pins: [
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
      { name: 'OUT', kind: 'analog' },
    ],
    currentDrawMa: 5,
    // No native Wokwi Hall-sensor part; a potentiometer stands in as the
    // analog value source for simulation purposes (plan Round 21 decision).
    wokwi: { part: 'wokwi-potentiometer', pinMap: { OUT: 'SIG' }, simSupported: true },
    muxChannels: 0,
  },
]
