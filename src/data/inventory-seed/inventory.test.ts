import { describe, it, expect } from 'vitest'
import { SensorSchema, ActuatorSchema } from '@/schema'
import { sensors } from './sensors'
import { actuators } from './actuators'

const OWNED_SENSOR_IDS = [
  'ina219', 'hbe0704', 'mpu6050', 'tsl2591', 'bme280',
  'ds18b20', 'tca9548a', 'cds', 'hc-sr501', 'hc-sr04',
]

describe('sensor inventory seed', () => {
  it('contains exactly the 10 owned sensors', () => {
    expect(sensors).toHaveLength(10)
    const ids = sensors.map((s) => s.id).sort()
    expect(ids).toEqual([...OWNED_SENSOR_IDS].sort())
  })

  it('every sensor validates against the Sensor schema with zero errors', () => {
    for (const sensor of sensors) {
      const result = SensorSchema.safeParse(sensor)
      expect(result.success, `${sensor.id}: ${JSON.stringify(result.success ? null : result.error.issues)}`).toBe(true)
    }
  })

  it('INA219 is strapped with 4 addresses via A0/A1', () => {
    const ina219 = sensors.find((s) => s.id === 'ina219')!
    expect(ina219.addressing).toEqual({
      mode: 'strapped',
      addresses: ['0x40', '0x41', '0x44', '0x45'],
      strapPins: ['A0', 'A1'],
      maxOnBus: 4,
    })
  })

  it('TSL2591 is fixed at a single address and sim-supported by a custom chip', () => {
    const tsl2591 = sensors.find((s) => s.id === 'tsl2591')!
    expect(tsl2591.addressing).toEqual({ mode: 'fixed', addresses: ['0x29'], maxOnBus: 1 })
    expect(tsl2591.wokwi.simSupported).toBe(true)
  })

  it('DS18B20 is onewire with a large maxOnBus', () => {
    const ds18b20 = sensors.find((s) => s.id === 'ds18b20')!
    expect(ds18b20.addressing.mode).toBe('onewire')
  })

  it('HBE0704 is analog with mode "none" and no bus address', () => {
    const hbe0704 = sensors.find((s) => s.id === 'hbe0704')!
    expect(hbe0704.interface).toBe('analog')
    expect(hbe0704.addressing).toEqual({ mode: 'none' })
  })

  it('uses exact Wokwi endpoint names for analog and ultrasonic stand-ins', () => {
    expect(sensors.find((s) => s.id === 'cds')?.wokwi.pinMap.AO).toBe('AO')
    expect(sensors.find((s) => s.id === 'hc-sr04')?.wokwi.pinMap).toMatchObject({
      TRIG: 'TRIG',
      ECHO: 'ECHO',
    })
    expect(sensors.find((s) => s.id === 'hbe0704')?.wokwi.pinMap.OUT).toBe('SIG')
  })

  it('every sensor with a native Wokwi part has simSupported=true and a real part id', () => {
    const nativeIds = ['mpu6050', 'ds18b20', 'cds', 'hc-sr501', 'hc-sr04']
    for (const id of nativeIds) {
      const sensor = sensors.find((s) => s.id === id)!
      expect(sensor.wokwi.simSupported, id).toBe(true)
      expect(sensor.wokwi.part.startsWith('wokwi-'), id).toBe(true)
    }
  })

  it('sim-coverage-derivable set includes all three packaged custom chips', () => {
    const supported = sensors.filter((s) => s.wokwi.simSupported)
    const unsupported = sensors.filter((s) => !s.wokwi.simSupported)
    expect(supported).toHaveLength(9)
    expect(supported.find((s) => s.id === 'bme280')?.wokwi.part).toBe('chip-bme280')
    expect(unsupported.map((s) => s.id)).toEqual(['tca9548a'])
  })
})

describe('actuator inventory seed', () => {
  it('covers all 4 owned categories', () => {
    const categories = new Set(actuators.map((a) => a.category))
    expect(categories).toEqual(new Set(['passive', 'motor', 'relay', 'display']))
  })

  it('every actuator validates against the Actuator schema with zero errors', () => {
    for (const actuator of actuators) {
      const result = ActuatorSchema.safeParse(actuator)
      expect(result.success, `${actuator.id}: ${JSON.stringify(result.success ? null : result.error.issues)}`).toBe(true)
    }
  })

  it('motor and relay category entries have currentDrawMa populated', () => {
    const motorAndRelay = actuators.filter((a) => a.category === 'motor' || a.category === 'relay')
    expect(motorAndRelay.length).toBeGreaterThan(0)
    for (const a of motorAndRelay) {
      expect(a.currentDrawMa, a.id).toBeGreaterThan(0)
    }
  })
})
