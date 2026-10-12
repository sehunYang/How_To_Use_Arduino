/**
 * Acceptance rules for one-time hardware checks (docs/hardware-check.md).
 *
 * Each probe sketch in hardware-check/probes prints `# key=value` identity
 * lines, a CSV header, and rows. A record is saved as
 * hardware-check/records/<sensor>/<condition>.csv, where the condition names
 * the physical reference it was taken against (ice water, a ruler distance,
 * a known resistor). The tolerances are the datasheets' own.
 */

export interface HardwareRecord {
  sensor: string
  condition: string
  identity: Record<string, string>
  columns: string[]
  rows: number[][]
}

export type CheckStatus = 'pass' | 'warn' | 'fail'

export interface HardwareCheck {
  name: string
  status: CheckStatus
  detail: string
}

export function parseHardwareRecord(sensor: string, condition: string, text: string): HardwareRecord {
  const identity: Record<string, string> = {}
  let columns: string[] = []
  const rows: number[][] = []
  for (const line of text.split(/\r?\n/).map((candidate) => candidate.trim()).filter(Boolean)) {
    const pair = /^#\s*([a-z_]+)=(.*)$/i.exec(line)
    if (pair) {
      identity[pair[1]] = pair[2].trim()
      continue
    }
    if (line.startsWith('#')) continue
    if (columns.length === 0) {
      columns = line.split(',')
      continue
    }
    const cells = line.split(',')
    if (cells.length !== columns.length) continue
    const values = cells.map((cell) => (/^0x[0-9a-f]+$/i.test(cell) ? Number.parseInt(cell, 16) : Number(cell)))
    if (values.every(Number.isFinite)) rows.push(values)
  }
  return { sensor, condition, identity, columns, rows }
}

export function column(record: HardwareRecord, name: string): number[] {
  const index = record.columns.indexOf(name)
  return index === -1 ? [] : record.rows.map((row) => row[index])
}

const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}
export const standardDeviation = (values: readonly number[]) => {
  const centre = mean(values)
  return Math.sqrt(mean(values.map((value) => (value - centre) ** 2)))
}

const check = (name: string, ok: boolean, detail: string, softly = false): HardwareCheck => ({
  name,
  status: ok ? 'pass' : softly ? 'warn' : 'fail',
  detail,
})

function within(name: string, values: readonly number[], expected: number, tolerance: number, unit: string): HardwareCheck {
  if (values.length === 0) return check(name, false, 'no readings')
  const value = mean(values)
  return check(name, Math.abs(value - expected) <= tolerance, `${value.toFixed(3)} ${unit} (expected ${expected} ± ${tolerance})`)
}

function enoughRows(record: HardwareRecord, minimum: number): HardwareCheck {
  return check('rows', record.rows.length >= minimum, `${record.rows.length} rows (need ${minimum})`)
}

function noise(name: string, values: readonly number[], limit: number, unit: string): HardwareCheck {
  const spread = standardDeviation(values)
  return check(name, spread <= limit, `σ = ${spread.toFixed(4)} ${unit} (limit ${limit})`)
}

type Rule = (record: HardwareRecord, others: ReadonlyMap<string, HardwareRecord>) => HardwareCheck[]

/** Conditions each sensor is checked against, and what that condition must show. */
export const HARDWARE_RULES: Readonly<Record<string, Readonly<Record<string, Rule>>>> = {
  ds18b20: {
    // Datasheet: ±0.5 °C from -10 to +85 °C.
    'ice-water': (record) => [
      enoughRows(record, 10),
      within('temperature', column(record, 'temperature_c'), 0, 0.5, '°C'),
      check('family', record.identity.family === '0x28', `family ${record.identity.family ?? 'missing'}: 0x28 is a DS18B20`),
      check('resolution', record.identity.resolution_bits === '12', `${record.identity.resolution_bits ?? '?'}-bit (recipes assume 12)`, true),
    ],
    room: (record) => {
      const values = column(record, 'temperature_c')
      return [
        enoughRows(record, 10),
        check('plausible', values.length > 0 && mean(values) > 10 && mean(values) < 35, `${values.length ? mean(values).toFixed(2) : '?'} °C`),
        check('not power-on value', !values.includes(85) && !values.includes(-127), '85 °C or -127 °C means no conversion or no probe'),
        noise('noise', values, 0.1, '°C'),
      ]
    },
  },
  mpu6050: {
    // Lying flat: gravity on +Z only. ±2 g zero-g offset spec is ±80 mg on X/Y.
    flat: (record) => [
      enoughRows(record, 100),
      within('az', column(record, 'az_g'), 1, 0.1, 'g'),
      within('ax', column(record, 'ax_g'), 0, 0.08, 'g'),
      within('ay', column(record, 'ay_g'), 0, 0.08, 'g'),
      within('gyro z offset', column(record, 'gz_dps'), 0, 5, '°/s'),
      noise('accel noise', column(record, 'az_g'), 0.02, 'g'),
      check(
        'chip',
        record.identity.who_am_i === '0x68',
        `WHO_AM_I ${record.identity.who_am_i ?? 'missing'}: 0x68 is an MPU6050; 0x70/0x71/0x98 are look-alikes`,
        true,
      ),
    ],
  },
  'hc-sr04': Object.fromEntries([20, 50, 100].map((cm) => [`target-${cm}cm`, (record: HardwareRecord) => {
    const distances = column(record, 'distance_cm')
    const echoes = distances.filter((value) => value > 0)
    const dropouts = distances.length - echoes.length
    return [
      enoughRows(record, 20),
      // Datasheet resolution 0.3 cm; allow 2 % or 1 cm for a hand-placed target.
      check('distance', echoes.length > 0 && Math.abs(median(echoes) - cm) <= Math.max(1, cm * 0.02),
        `median ${echoes.length ? median(echoes).toFixed(1) : '?'} cm (target ${cm})`),
      check('dropouts', dropouts <= distances.length * 0.05, `${dropouts} of ${distances.length} readings without an echo`),
      noise('jitter', echoes, 1, 'cm'),
    ]
  }])),
  bme280: {
    room: (record) => [
      enoughRows(record, 10),
      check('chip', record.identity.chip_id === '0x60',
        `chip ID ${record.identity.chip_id ?? 'missing'}: 0x60 is a BME280; 0x58 is a BMP280 with no humidity sensor`),
      check('address', record.identity.address === '0x76',
        `answers at ${record.identity.address ?? '?'}; the recipes call bme.begin(0x76)`, true),
      check('temperature', mean(column(record, 'temperature_c')) > 10 && mean(column(record, 'temperature_c')) < 35, 'room range'),
      check('pressure', mean(column(record, 'pressure_hpa')) > 950 && mean(column(record, 'pressure_hpa')) < 1050, 'sea-level-ish'),
      check('humidity', mean(column(record, 'humidity_pct')) > 10 && mean(column(record, 'humidity_pct')) < 90, 'indoor range'),
      noise('pressure noise', column(record, 'pressure_hpa'), 0.12, 'hPa'),
    ],
  },
  tsl2591: {
    dark: (record) => [
      enoughRows(record, 10),
      check('id', record.identity.device_id === '0x50', `device ID ${record.identity.device_id ?? 'missing'} (expected 0x50)`),
      check('dark counts', mean(column(record, 'ch0')) < 50, `CH0 ${mean(column(record, 'ch0')).toFixed(1)} counts covered`),
    ],
    lit: (record, others) => {
      const dark = others.get('dark')
      const lit = mean(column(record, 'ch0'))
      return [
        enoughRows(record, 10),
        check('saturation', !column(record, 'ch0').includes(65535), 'CH0 must stay below 65535 at low gain'),
        check('response', dark !== undefined && lit > 10 * Math.max(1, mean(column(dark, 'ch0'))),
          dark ? `lit ${lit.toFixed(0)} vs dark ${mean(column(dark, 'ch0')).toFixed(0)} counts` : 'record dark.csv as well'),
      ]
    },
  },
  hall: {
    'no-magnet': (record) => [
      enoughRows(record, 20),
      // Ratiometric Hall sensors sit at VCC/2 with no field; the recipes assume 512.
      within('zero level', column(record, 'raw'), 512, 40, 'counts'),
      noise('noise', column(record, 'raw'), 3, 'counts'),
    ],
    north: (record, others) => hallPole(record, others, 'south'),
    south: (record, others) => hallPole(record, others, 'north'),
  },
  pir: {
    quiet: (record) => [
      enoughRows(record, 40),
      check('no false triggers', column(record, 'motion').every((value) => value === 0), 'room empty for the whole capture'),
    ],
    motion: (record) => [
      enoughRows(record, 20),
      check('detects', column(record, 'motion').some((value) => value === 1), 'hand waved 1 m in front'),
    ],
  },
  cds: {
    dark: (record) => [enoughRows(record, 20)],
    lit: (record, others) => {
      const dark = others.get('dark')
      const difference = dark ? Math.abs(mean(column(record, 'raw')) - mean(column(dark, 'raw'))) : 0
      return [
        enoughRows(record, 20),
        check('response', difference > 200, dark ? `lit vs dark differ by ${difference.toFixed(0)} counts` : 'record dark.csv as well'),
      ]
    },
  },
  tca9548a: {
    scan: (record) => [
      check('mux', record.identity.mux === '0x70', `multiplexer at ${record.identity.mux ?? '?'} (recipes use 0x70)`),
      check('channels', record.rows.length > 0, `${record.rows.length} devices found behind the multiplexer`),
    ],
  },
}

function hallPole(record: HardwareRecord, others: ReadonlyMap<string, HardwareRecord>, opposite: string): HardwareCheck[] {
  const zero = others.get('no-magnet')
  const opposing = others.get(opposite)
  const offset = mean(column(record, 'raw')) - (zero ? mean(column(zero, 'raw')) : 512)
  const checks = [enoughRows(record, 20), check('field', Math.abs(offset) > 100, `${offset.toFixed(0)} counts from zero`)]
  if (opposing) {
    const other = mean(column(opposing, 'raw')) - (zero ? mean(column(zero, 'raw')) : 512)
    checks.push(check('polarity', Math.sign(other) === -Math.sign(offset), 'north and south move the output in opposite directions'))
  }
  return checks
}

/** INA219 against a known load: `load-<ohms>ohm-<volts>v`, e.g. load-100ohm-5v. */
export function ina219LoadRule(condition: string): Rule | undefined {
  const match = /^load-(\d+(?:\.\d+)?)ohm-(\d+(?:\.\d+)?)v$/.exec(condition)
  if (!match) return undefined
  const [ohms, volts] = [Number(match[1]), Number(match[2])]
  const milliamps = (volts / ohms) * 1000
  return (record) => [
    enoughRows(record, 10),
    within('bus voltage', column(record, 'bus_v'), volts, 0.1, 'V'),
    // Datasheet: ±1 % gain error at 25 °C; allow 5 % plus one LSB for resistor tolerance.
    within('current', column(record, 'current_ma'), milliamps, milliamps * 0.05 + 0.1, 'mA'),
  ]
}

export function checkHardwareRecord(record: HardwareRecord, others: ReadonlyMap<string, HardwareRecord>): HardwareCheck[] {
  const rule = record.sensor === 'ina219' ? ina219LoadRule(record.condition) : HARDWARE_RULES[record.sensor]?.[record.condition]
  if (!rule) return [check('condition', false, `no rule for ${record.sensor}/${record.condition}`)]
  return rule(record, others)
}

/** The conditions a complete check of each sensor needs. */
export const REQUIRED_CONDITIONS: Readonly<Record<string, string[]>> = {
  ds18b20: ['ice-water', 'room'],
  mpu6050: ['flat'],
  'hc-sr04': ['target-20cm', 'target-50cm', 'target-100cm'],
  bme280: ['room'],
  tsl2591: ['dark', 'lit'],
  ina219: ['load-<ohms>ohm-<volts>v'],
  hall: ['no-magnet', 'north', 'south'],
  pir: ['quiet', 'motion'],
  cds: ['dark', 'lit'],
  tca9548a: ['scan'],
}
