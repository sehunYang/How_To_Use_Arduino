import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { checkHardwareRecord, HARDWARE_RULES, parseHardwareRecord, REQUIRED_CONDITIONS } from './acceptance'

const record = (sensor: string, condition: string, lines: string[]) =>
  parseHardwareRecord(sensor, condition, lines.join('\n'))

const rows = (count: number, row: (index: number) => string) => Array.from({ length: count }, (_, index) => row(index))

const statuses = (sensor: string, condition: string, lines: string[], others: string[][] = []) => {
  const target = record(sensor, condition, lines)
  const siblings = new Map(others.map((other) => {
    const [name, ...rest] = other
    return [name, record(sensor, name, rest)]
  }))
  return Object.fromEntries(checkHardwareRecord(target, siblings).map((result) => [result.name, result.status]))
}

describe('hardware record parsing', () => {
  it('reads identity lines, the header and numeric rows (hex included)', () => {
    const parsed = record('tca9548a', 'scan', ['# PROBE tca9548a v1', '# mux=0x70', 'channel,address', '0,0x29', '3,0x76'])
    expect(parsed.identity).toEqual({ mux: '0x70' })
    expect(parsed.rows).toEqual([[0, 0x29], [3, 0x76]])
  })
})

describe('hardware acceptance rules', () => {
  it('passes a genuine DS18B20 in ice water and fails one 1 °C off', () => {
    const ok = statuses('ds18b20', 'ice-water', ['# family=0x28', '# resolution_bits=12', 'time_ms,index,temperature_c', ...rows(12, (i) => `${i},0,0.0625`)])
    expect(ok).toEqual({ rows: 'pass', temperature: 'pass', family: 'pass', resolution: 'pass' })
    const off = statuses('ds18b20', 'ice-water', ['# family=0x28', 'time_ms,index,temperature_c', ...rows(12, (i) => `${i},0,1.0`)])
    expect(off.temperature).toBe('fail')
  })

  it('rejects a BMP280 sold as a BME280 and warns about the 0x77 address', () => {
    const lines = (id: string, address: string) =>
      [`# chip_id=${id}`, `# address=${address}`, 'time_ms,temperature_c,pressure_hpa,humidity_pct', ...rows(12, (i) => `${i},23.1,1008.2,45`)]
    expect(statuses('bme280', 'room', lines('0x60', '0x76')).chip).toBe('pass')
    expect(statuses('bme280', 'room', lines('0x58', '0x76')).chip).toBe('fail')
    expect(statuses('bme280', 'room', lines('0x60', '0x77')).address).toBe('warn')
  })

  it('flags an MPU6050 look-alike without failing a working board', () => {
    const lines = (whoAmI: string) =>
      [`# who_am_i=${whoAmI}`, 'time_ms,ax_g,ay_g,az_g,gx_dps,gy_dps,gz_dps', ...rows(120, (i) => `${i},0.01,-0.02,${1 + (i % 2) * 0.004},0.3,-0.2,0.5`)]
    expect(statuses('mpu6050', 'flat', lines('0x68'))).toEqual({
      rows: 'pass', az: 'pass', ax: 'pass', ay: 'pass', 'gyro z offset': 'pass', 'accel noise': 'pass', chip: 'pass',
    })
    expect(statuses('mpu6050', 'flat', lines('0x70')).chip).toBe('warn')
  })

  it('judges sonar distance by the median and counts dropouts', () => {
    const good = statuses('hc-sr04', 'target-50cm', ['time_ms,echo_us,distance_cm', ...rows(30, (i) => `${i},2900,${i === 3 ? -1 : 50.2}`)])
    expect(good).toEqual({ rows: 'pass', distance: 'pass', dropouts: 'pass', jitter: 'pass' })
    const lossy = statuses('hc-sr04', 'target-50cm', ['time_ms,echo_us,distance_cm', ...rows(30, (i) => `${i},0,${i % 3 ? 50 : -1}`)])
    expect(lossy.dropouts).toBe('fail')
  })

  it('reads the INA219 load from the file name', () => {
    const lines = (milliamps: number) => ['time_ms,bus_v,shunt_mv,current_ma', ...rows(12, (i) => `${i},4.98,${milliamps / 10},${milliamps}`)]
    expect(statuses('ina219', 'load-100ohm-5v', lines(49.6))).toEqual({ rows: 'pass', 'bus voltage': 'pass', current: 'pass' })
    expect(statuses('ina219', 'load-100ohm-5v', lines(40)).current).toBe('fail')
    expect(statuses('ina219', 'mystery', lines(40)).condition).toBe('fail')
  })

  it('compares lit against dark and north against south', () => {
    const dark = ['dark', 'time_ms,ch0,ch1,lux', ...rows(12, (i) => `${i},3,1,0.1`)]
    const lit = statuses('tsl2591', 'lit', ['time_ms,ch0,ch1,lux', ...rows(12, (i) => `${i},4000,900,1200`)], [dark])
    expect(lit.response).toBe('pass')
    const zero = ['no-magnet', 'time_ms,raw', ...rows(25, (i) => `${i},515`)]
    const south = ['south', 'time_ms,raw', ...rows(25, (i) => `${i},820`)]
    const north = statuses('hall', 'north', ['time_ms,raw', ...rows(25, (i) => `${i},240`)], [zero, south])
    expect(north).toEqual({ rows: 'pass', field: 'pass', polarity: 'pass' })
  })

  it('has a rule for every required condition and a probe for every sensor', () => {
    const probes = readdirSync('hardware-check/probes').sort()
    expect(Object.keys(REQUIRED_CONDITIONS).sort()).toEqual(probes)
    for (const [sensor, conditions] of Object.entries(REQUIRED_CONDITIONS)) {
      if (sensor === 'ina219') continue
      for (const condition of conditions) expect(HARDWARE_RULES[sensor]?.[condition], `${sensor}/${condition}`).toBeDefined()
    }
  })
})
