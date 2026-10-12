/**
 * Behavioural Wokwi specs for the Phase 6 and Phase 7 recipes. Same rules as
 * behaviorSpecs.ts: the student's sketch runs unmodified, and every expected
 * value comes from the stimulus and a datasheet or physics relation.
 *
 * Recipes that share one sketch (ph28-ph33, ph01/ph05/ph34, ...) share a
 * builder, but each gets the stimulus sequence of its own experiment.
 */

import {
  accelG,
  approx,
  type BmeRaw,
  bmeSteps,
  delayMs,
  derived,
  DS18B20_LSB_C,
  echo,
  adc,
  expectPin,
  lux,
  type ParsedRow,
  type Phase5BehaviorSpec,
  type ScenarioStep,
  set,
  waitSerial,
} from './behaviorSpecHelpers'
import {
  BME280_DEFAULT_RAW,
  bme280HumidityPct,
  bme280HumidityRawFor,
  bme280PressureHpa,
  bme280TemperatureC,
  bme280TemperatureRawFor,
  ina219BusRegisterFor,
  ina219BusVolts,
  ina219CurrentMa,
  TSL2591_DEFAULT_RAW,
  TSL2591_GAIN,
} from './sensorOracles'

const MPU_DEFAULT = { x: 0, y: 0, z: 1 }

type Axes = { x: number; y: number; z: number }

/** One set-control per axis that changed. */
function accelSteps(partId: string, from: Axes, to: Axes): ScenarioStep[] {
  return (['x', 'y', 'z'] as const)
    .filter((axis) => from[axis] !== to[axis])
    .map((axis) => set(partId, `accel${axis.toUpperCase()}`, to[axis]))
}

const fixed = (value: number, decimals: number) => value.toFixed(decimals)

/** Rows whose `column` cycles through `sequence` in order, starting anywhere. */
function cycles(column: string, sequence: readonly number[]) {
  return (rows: readonly ParsedRow[]) => {
    const failures: string[] = []
    const values = rows.map((row) => row.values[column])
    const start = sequence.indexOf(values[0])
    if (start === -1) return [`first ${column}=${values[0]} is not in ${sequence.join('/')}`]
    values.forEach((value, index) => {
      const expected = sequence[(start + index) % sequence.length]
      if (value !== expected) failures.push(`row ${index + 1}: ${column}=${value}, expected ${expected}`)
    })
    return failures
  }
}

// ── MPU6050 accelerometer, printed in g ─────────────────────────────────────

function mpuAccelG(
  recipeId: string,
  states: Array<{ label: string } & Axes>,
  options: { decimals: number; interval: { min: number; max: number } },
): Phase5BehaviorSpec {
  const header = 'time_ms,acceleration_x_g,acceleration_y_g,acceleration_z_g'
  const format = ({ x, y, z }: Axes) =>
    `,${fixed(accelG(x), options.decimals)},${fixed(accelG(y), options.decimals)},${fixed(accelG(z), options.decimals)}`
  return {
    recipeId,
    header,
    phases: states.map((state, index) => ({
      label: state.label,
      steps: [...(index === 0 ? [] : accelSteps('mpu6050', states[index - 1], state)), waitSerial(format(state))],
      expect: {
        acceleration_x_g: approx(accelG(state.x), 0.0001),
        acceleration_y_g: approx(accelG(state.y), 0.0001),
        acceleration_z_g: approx(accelG(state.z), 0.0001),
      },
    })),
    finalSteps: [delayMs(300)],
    timeColumn: 'time_ms',
    sampleInterval: options.interval,
    minRows: states.length + 1,
  }
}

const accel100 = { decimals: 5, interval: { min: 100, max: 106 } }

/** |a| in g from the MPU6050 library at ±2 g, 115200 baud, 20 ms. */
function mpuNorm(recipeId: string, labels: [string, string, string]): Phase5BehaviorSpec {
  const states: Array<Axes & { label: string }> = [
    { label: labels[0], ...MPU_DEFAULT },
    { label: labels[1], x: 0, y: 0, z: 1.5 },
    { label: labels[2], x: 0.5, y: 0, z: 1.5 },
  ]
  return {
    recipeId,
    header: 'time_ms,g_norm',
    phases: states.map((state, index) => {
      const norm = Math.hypot(accelG(state.x), accelG(state.y), accelG(state.z))
      return {
        label: state.label,
        steps: [...(index === 0 ? [] : accelSteps('mpu6050', states[index - 1], state)), waitSerial(`,${fixed(norm, 4)}`)],
        expect: { g_norm: approx(norm, 0.0002) },
      }
    }),
    finalSteps: [delayMs(300)],
    timeColumn: 'time_ms',
    sampleInterval: { min: 20, max: 21 },
    minRows: 10,
  }
}

// ── HC-SR04 ─────────────────────────────────────────────────────────────────

/** `distance_m` sketches at 100 ms (ph01, ph05, ph34 share this sketch). */
function sonarMeters(recipeId: string, states: Array<{ label: string; cm: number }>): Phase5BehaviorSpec {
  return {
    recipeId,
    header: 'time_ms,distance_m',
    phases: states.map(({ label, cm }, index) => ({
      label,
      steps: [...(index === 0 && cm === 400 ? [] : [set('hc-sr04', 'distance', cm)]), delayMs(700)],
      expect: { distance_m: echo(cm, 'm') },
    })),
    // A reading taken before the first distance lands still shows the default 4 m.
    startupRows: states[0].cm === 400 ? 0 : 1,
    // 100 ms delay + the echo itself (up to 23 ms at 4 m).
    timeColumn: 'time_ms',
    sampleInterval: { min: 100, max: 128 },
    minRows: states.length * 4,
  }
}

/** Integer centimetres from pulse/58 µs. */
const echoCm = (cm: number) => approx(cm, cm * 0.02 + 1)

// ── DS18B20 ─────────────────────────────────────────────────────────────────

/** Single probe through DallasTemperature, printed with 2 decimals. */
function dallasSingle(
  recipeId: string,
  column: string,
  temperatures: Array<{ label: string; celsius: number }>,
  intervalMs: number,
): Phase5BehaviorSpec {
  return {
    recipeId,
    header: `time_ms,${column}`,
    phases: temperatures.map(({ label, celsius }, index) => ({
      label,
      steps: [
        ...(index === 0 && celsius === 22 ? [] : [set('ds18b20', 'temperature', celsius)]),
        waitSerial(`,${fixed(celsius, 2)}`),
      ],
      expect: { [column]: approx(celsius, DS18B20_LSB_C) },
    })),
    // A reading taken before the first stimulus lands still shows the 22 °C default.
    startupRows: temperatures[0]?.celsius === 22 ? 0 : 1,
    timeColumn: 'time_ms',
    // requestTemperatures() blocks up to 750 ms before the sketch's own delay.
    sampleInterval: { min: intervalMs, max: intervalMs + 900 },
    minRows: temperatures.length,
  }
}

/** Two probes on one bus; which one enumerates first depends on ROM order, not wiring. */
function twoProbesEitherOrder(columns: [string, string], pairs: Array<[number, number]>) {
  return (rows: readonly ParsedRow[]) => {
    const last = rows[rows.length - 1]
    const seen = [last.values[columns[0]], last.values[columns[1]]].sort((a, b) => a - b)
    const expected = [...pairs[pairs.length - 1]].sort((a, b) => a - b)
    return seen.every((value, index) => Math.abs(value - expected[index]) <= DS18B20_LSB_C)
      ? []
      : [`last row read ${seen.join('/')} °C, expected one probe each at ${expected.join('/')} °C`]
  }
}

// ── TSL2591 raw CH0 through bare register access (LOW gain, 100 ms) ─────────

function tslRaw(recipeId: string, states: Array<{ label: string; ch0: number }>): Phase5BehaviorSpec {
  return {
    recipeId,
    header: 'time_ms,light_raw',
    phases: states.map(({ label, ch0 }, index) => ({
      label,
      steps: [...(index === 0 && ch0 === TSL2591_DEFAULT_RAW.ch0 ? [] : [set('tsl2591', 'ch0Raw', ch0)]), delayMs(600)],
      // LOW gain and 100 ms integration: the ADC count is the incident light count itself.
      expect: { light_raw: approx(ch0, 0) },
    })),
    startupRows: states[0].ch0 === TSL2591_DEFAULT_RAW.ch0 ? 0 : 1,
    timeColumn: 'time_ms',
    sampleInterval: { min: 100, max: 106 },
    minRows: states.length * 4,
  }
}

// ── INA219 read as bare registers with a 0.1 Ω shunt ────────────────────────

const shuntRawFor = (milliamps: number) => Math.round(milliamps * 10)
const current = (shuntRaw: number) => approx(ina219CurrentMa(shuntRaw), 0.001)
const busVolts = (register: number) => approx(ina219BusVolts(register), 0.0001)

function inaSteps(from: { shunt: number; bus: number }, to: { shunt: number; bus: number }): ScenarioStep[] {
  return [
    ...(from.shunt !== to.shunt ? [set('ina219', 'shuntRaw', to.shunt)] : []),
    ...(from.bus !== to.bus ? [set('ina219', 'busRaw', to.bus)] : []),
  ]
}

const INA_DEFAULT = { shunt: 100, bus: 5000 }

/** Ohm's-law style: a source of `volts` across `ohms`, quantised as the INA219 does. */
const load = (volts: number, ohms: number) => ({
  shunt: shuntRawFor((volts / ohms) * 1000),
  bus: ina219BusRegisterFor(volts),
})

function inaEquivalentResistance(
  recipeId: string,
  states: Array<{ label: string; volts: number; ohms: number }>,
): Phase5BehaviorSpec {
  const header = 'condition_id,time_ms,bus_V,current_mA,equivalent_ohm'
  const loads = states.map(({ volts, ohms }) => load(volts, ohms))
  return {
    recipeId,
    header,
    textColumns: ['condition_id'],
    phases: states.map(({ label, ohms }, index) => ({
      label,
      steps: [...inaSteps(index === 0 ? INA_DEFAULT : loads[index - 1], loads[index]), delayMs(1500)],
      expect: {
        bus_V: busVolts(loads[index].bus),
        current_mA: current(loads[index].shunt),
        // R = V / I, within the 0.1 mA current LSB.
        equivalent_ohm: approx(ohms, ohms * 0.02),
      },
      settleRows: index === 0 ? 0 : 1,
    })),
    startupRows: 1,
    always: {
      equivalent_ohm: derived(({ values }) => values.bus_V / (values.current_mA / 1000), 1),
    },
    timeColumn: 'time_ms',
    sampleInterval: { min: 500, max: 520 },
    minRows: states.length * 2,
  }
}

function solenoid(recipeId: string, condition: string): Phase5BehaviorSpec {
  // Field at the Hall sensor grows linearly with coil current: B = k I.
  const states = [
    { label: 'no current', milliamps: 0, position: 0.5 },
    { label: '50 mA', milliamps: 50, position: 0.6 },
    { label: '100 mA', milliamps: 100, position: 0.7 },
  ]
  return {
    recipeId,
    header: 'condition_id,time_ms,current_mA,hall_raw',
    textColumns: ['condition_id'],
    phases: states.map(({ label, milliamps, position }, index) => ({
      label,
      steps: [set('ina219', 'shuntRaw', shuntRawFor(milliamps)), set('hbe0704', 'position', position), delayMs(800)],
      expect: {
        condition_id: { text: condition },
        current_mA: current(shuntRawFor(milliamps)),
        hall_raw: adc(position),
      },
      settleRows: index === 0 ? 0 : 1,
    })),
    startupRows: 1,
    checkRows: (rows) => {
      // Hall output minus its zero-field level, per milliamp, must agree between the two currents.
      const slope = (milliamps: number) => {
        const row = [...rows].reverse().find((candidate) => Math.abs(candidate.values.current_mA - milliamps) < 0.05)
        return row ? (row.values.hall_raw - 512) / milliamps : Number.NaN
      }
      const [a, b] = [slope(50), slope(100)]
      return Math.abs(a - b) <= 0.05 ? [] : [`field per mA ${a.toFixed(3)} vs ${b.toFixed(3)}: not proportional`]
    },
    timeColumn: 'time_ms',
    sampleInterval: { min: 250, max: 265 },
    minRows: 6,
  }
}

// ── Hall pulse counter (ph08, ph10, ph26) ───────────────────────────────────

/** Toggle the Hall stand-in through a magnet pass every `periodMs`. */
function magnetPasses(count: number, periodMs: number): ScenarioStep[] {
  return Array.from({ length: count }, () => [
    set('hbe0704', 'position', 0),
    delayMs(periodMs / 2),
    set('hbe0704', 'position', 1),
    delayMs(periodMs / 2),
  ]).flat()
}

function rotatingMagnet(recipeId: string): Phase5BehaviorSpec {
  const periodMs = 200
  return {
    recipeId,
    header: 'time_ms,hall_raw,pulse_count,pulse_interval_us',
    phases: [
      {
        // The potentiometer powers up at 0 V: a magnet already at the sensor, counted once.
        label: 'magnet parked at power-on, then moved away',
        steps: [set('hbe0704', 'position', 1), delayMs(500)],
        expect: { pulse_count: approx(1, 0), pulse_interval_us: approx(0, 0) },
      },
      {
        label: 'rotor turning, one pass every 200 ms',
        steps: magnetPasses(10, periodMs),
        expect: { pulse_count: { min: 1, max: 11 }, hall_raw: { oneOf: [0, 1023], tolerance: 3 } },
      },
    ],
    finalSteps: [delayMs(500)],
    // After the rotor stops: one count for the parked magnet plus one per pass, at the pass period.
    checkRows: (rows) => {
      const last = rows[rows.length - 1].values
      const failures: string[] = []
      if (last.pulse_count !== 11) failures.push(`${last.pulse_count} pulses counted, expected 11`)
      if (Math.abs(last.pulse_interval_us - periodMs * 1000) > 2000) {
        failures.push(`last pulse interval ${last.pulse_interval_us} µs, expected ${periodMs * 1000}`)
      }
      return failures
    },
    timeColumn: 'time_ms',
    sampleInterval: { min: 100, max: 106 },
    minRows: 20,
  }
}

function gyroVersusHall(recipeId: string): Phase5BehaviorSpec {
  // 240 °/s is 40 rpm: one magnet pass every 1.5 s. Gyro and Hall must agree.
  const dps = 240
  const periodMs = 1500
  return {
    recipeId,
    header: 'time_ms,gyro_z_dps,hall_raw,pulse_count,pulse_interval_us',
    phases: [
      {
        label: 'disc at rest',
        steps: [set('hbe0704', 'position', 1), delayMs(400)],
        expect: { gyro_z_dps: approx(0, 0.01), pulse_count: approx(1, 0) },
      },
      {
        label: 'disc spinning at 240 °/s (40 rpm)',
        steps: [set('mpu6050', 'rotationZ', dps), ...magnetPasses(4, periodMs)],
        expect: { gyro_z_dps: approx(dps, 0.01) },
        settleRows: 1,
      },
    ],
    checkRows: (rows) => {
      const last = rows[rows.length - 1].values
      // rpm from the Hall pulse interval, converted to °/s.
      const hallDps = (60e6 / last.pulse_interval_us) * 6
      return Math.abs(hallDps - last.gyro_z_dps) <= last.gyro_z_dps * 0.02
        ? []
        : [`Hall says ${hallDps.toFixed(1)} °/s, gyro ${last.gyro_z_dps} °/s`]
    },
    timeColumn: 'time_ms',
    sampleInterval: { min: 100, max: 110 },
    minRows: 20,
  }
}

// ── BME280 through the recipes' bare-register driver (integer compensation) ─

function bmeRawDriver(recipeId: string, labels: [string, string, string]): Phase5BehaviorSpec {
  const t31 = bme280TemperatureRawFor(31)
  const states: Array<{ label: string; raw: BmeRaw }> = [
    { label: labels[0], raw: { ...BME280_DEFAULT_RAW } },
    { label: labels[1], raw: { ...BME280_DEFAULT_RAW, temperature: t31 } },
    { label: labels[2], raw: { ...BME280_DEFAULT_RAW, temperature: t31, pressure: 440000 } },
  ]
  return {
    recipeId,
    header: 'time_ms,temperature_c,pressure_hpa',
    phases: states.map(({ label, raw }, index) => ({
      label,
      steps: [...(index === 0 ? [] : bmeSteps('bme280', states[index - 1].raw, raw)), delayMs(700)],
      expect: {
        temperature_c: approx(bme280TemperatureC(raw.temperature), 0.011),
        pressure_hpa: approx(bme280PressureHpa(raw.pressure, raw.temperature), 0.02),
      },
      settleRows: index === 0 ? 0 : 1,
    })),
    timeColumn: 'time_ms',
    sampleInterval: { min: 100, max: 112 },
    minRows: 12,
  }
}

const bmeT = (raw: BmeRaw) => approx(bme280TemperatureC(raw.temperature), 0.015)
const bmeH = (raw: BmeRaw) => approx(bme280HumidityPct(raw.humidity, raw.temperature), 0.15)
const bmeP = (raw: BmeRaw) => approx(bme280PressureHpa(raw.pressure, raw.temperature), 0.05)

// ── Phase 6 ─────────────────────────────────────────────────────────────────

const phase6: Phase5BehaviorSpec[] = [
  {
    recipeId: 's11-tsl2591-interrupt',
    header: 'event,time_ms,interrupt_count,light_raw',
    textColumns: ['event'],
    phases: [
      {
        label: 'light inside the 1000-10000 window: no interrupt',
        steps: [delayMs(500)],
        expect: { event: { text: 'sample' }, interrupt_count: approx(0, 0), light_raw: approx(TSL2591_DEFAULT_RAW.ch0, 0) },
      },
      {
        label: 'shadow drops CH0 below 1000: one interrupt',
        steps: [set('tsl2591', 'ch0Raw', 500), delayMs(600)],
        expect: { interrupt_count: approx(1, 0), light_raw: approx(500, 0) },
        settleRows: 1,
      },
      {
        label: 'back inside the window: no new interrupt',
        steps: [set('tsl2591', 'ch0Raw', 2000), delayMs(400)],
        expect: { interrupt_count: approx(1, 0), light_raw: approx(2000, 0) },
        settleRows: 1,
      },
      {
        label: 'flash above 10000: a second interrupt',
        steps: [set('tsl2591', 'ch0Raw', 20000), delayMs(600)],
        expect: { interrupt_count: approx(2, 0), light_raw: approx(20000, 0) },
        settleRows: 1,
      },
    ],
    checkRows: (rows) => {
      const events = rows.filter((row) => row.cells.event === 'INT').length
      return events === 2 ? [] : [`${events} INT rows, expected one per threshold crossing (2)`]
    },
    minRows: 20,
  },
  {
    recipeId: 's12-dual-mpu6050-address',
    header: 'time_ms,mpu_0x68_accel_x_raw,mpu_0x69_accel_x_raw',
    phases: [
      {
        label: 'both boards level',
        steps: [waitSerial(',0,0')],
        expect: { mpu_0x68_accel_x_raw: approx(0, 0), mpu_0x69_accel_x_raw: approx(0, 0) },
      },
      {
        label: 'tilt only the AD0=LOW board (0x68) by +0.5 g',
        steps: [set('mpu6050_1', 'accelX', 0.5), waitSerial(',8192,0')],
        expect: { mpu_0x68_accel_x_raw: approx(8192, 0), mpu_0x69_accel_x_raw: approx(0, 0) },
      },
      {
        label: 'tilt only the AD0=HIGH board (0x69) by -0.25 g',
        steps: [set('mpu6050_2', 'accelX', -0.25), waitSerial(',8192,-4096')],
        expect: { mpu_0x68_accel_x_raw: approx(8192, 0), mpu_0x69_accel_x_raw: approx(-4096, 0) },
      },
    ],
    finalSteps: [delayMs(300)],
    timeColumn: 'time_ms',
    sampleInterval: { min: 100, max: 106 },
    minRows: 4,
  },
  {
    recipeId: 'p9-motion-interrupt',
    header: 'time_us,acceleration_x_g,acceleration_y_g,acceleration_z_g',
    phases: [
      {
        label: 'at rest, ±16 g range',
        steps: [waitSerial(',0.0000,0.0000,1.0000')],
        expect: {
          acceleration_x_g: approx(0, 0.0005),
          acceleration_y_g: approx(0, 0.0005),
          acceleration_z_g: approx(1, 0.0005),
        },
      },
      {
        label: 'collision peak of 4 g (beyond the ±2 g default)',
        steps: [set('mpu6050', 'accelX', 4), waitSerial(',4.0000,0.0000,1.0000')],
        expect: { acceleration_x_g: approx(4, 0.0005), acceleration_z_g: approx(1, 0.0005) },
      },
    ],
    finalSteps: [delayMs(200)],
    // Data-ready interrupts at 1 kHz / (1 + divider 4) = 200 Hz.
    timeColumn: 'time_us',
    sampleInterval: { min: 4800, max: 5200 },
    minRows: 20,
  },
  sonarMeters('ph01-uniform-motion', [
    { label: 'cart 0.5 m from the sensor', cm: 50 },
    { label: 'cart at 1.0 m', cm: 100 },
    { label: 'cart at 1.5 m', cm: 150 },
  ]),
  mpuAccelG('ph02-newton-second-law', [
    { label: 'cart at rest', ...MPU_DEFAULT },
    { label: 'pulled by one weight: 0.25 g', x: 0.25, y: 0, z: 1 },
    { label: 'pulled by twice the weight: 0.5 g', x: 0.5, y: 0, z: 1 },
  ], accel100),
  {
    recipeId: 'ph03-projectile-motion',
    header: 'time_ms,distance_m,acceleration_x_g',
    phases: [
      { label: 'ball 4 m away, at rest', steps: [delayMs(500)], expect: { distance_m: echo(400, 'm'), acceleration_x_g: approx(0, 0.0001) } },
      {
        label: 'ball at 1.5 m',
        steps: [set('hc-sr04', 'distance', 150), delayMs(500)],
        expect: { distance_m: echo(150, 'm'), acceleration_x_g: approx(0, 0.0001) },
      },
      {
        label: 'launcher kicks back at -0.25 g',
        steps: [set('mpu6050', 'accelX', -0.25), delayMs(500)],
        expect: { distance_m: echo(150, 'm'), acceleration_x_g: approx(-0.25, 0.0001) },
      },
    ],
    timeColumn: 'time_ms',
    sampleInterval: { min: 100, max: 130 },
    minRows: 10,
  },
  {
    recipeId: 'ph04-momentum-collision',
    header: 'time_ms,mpu0_ax_g,mpu1_ax_g',
    phases: [
      {
        label: 'both carts coasting',
        steps: [waitSerial(',0.0000,0.0000')],
        expect: { mpu0_ax_g: approx(0, 0.0005), mpu1_ax_g: approx(0, 0.0005) },
      },
      {
        // Momentum conservation: equal and opposite forces on equal masses.
        label: 'collision: +4 g on one cart, -4 g on the other (±16 g range)',
        steps: [set('mpu6050_1', 'accelX', 4), set('mpu6050_2', 'accelX', -4), waitSerial(',4.0000,-4.0000')],
        expect: { mpu0_ax_g: approx(4, 0.0005), mpu1_ax_g: approx(-4, 0.0005) },
        settleRows: 1,
      },
    ],
    finalSteps: [delayMs(100)],
    timeColumn: 'time_ms',
    sampleInterval: { min: 5, max: 6 },
    minRows: 10,
  },
  sonarMeters('ph05-restitution-coefficient', [
    { label: 'dropped from 1.0 m below the sensor', cm: 100 },
    { label: 'first bounce apex: 0.64 m of height lost to e = 0.8', cm: 136 },
    { label: 'second bounce apex', cm: 159 },
  ]),
  mpuAccelG('ph06-spring-oscillation', [
    { label: 'mass at equilibrium', ...MPU_DEFAULT },
    { label: 'stretched: restoring force +0.375 g', x: 0.375, y: 0, z: 1 },
    { label: 'compressed: restoring force -0.375 g', x: -0.375, y: 0, z: 1 },
  ], accel100),
  {
    recipeId: 'ph07-centripetal-acceleration',
    header: 'time_ms,acceleration_x_g,acceleration_y_g,acceleration_z_g,gyro_z_dps',
    phases: [
      {
        label: 'turntable still',
        steps: [waitSerial(',0.00000,0.00000,1.00000,0.000')],
        expect: { acceleration_x_g: approx(0, 0.0001), gyro_z_dps: approx(0, 0.01) },
      },
      {
        label: 'turning at 180 °/s',
        steps: [set('mpu6050', 'rotationZ', 180), waitSerial(',0.00000,0.00000,1.00000,180.000')],
        expect: { acceleration_x_g: approx(0, 0.0001), gyro_z_dps: approx(180, 0.01) },
      },
      {
        // a = ω² r: 0.25 g at π rad/s means r = 0.248 m.
        label: 'centripetal 0.25 g at 0.248 m from the axis',
        steps: [set('mpu6050', 'accelX', 0.25), waitSerial(',0.25000,0.00000,1.00000,180.000')],
        expect: { acceleration_x_g: approx(0.25, 0.0001), gyro_z_dps: approx(180, 0.01) },
      },
    ],
    finalSteps: [delayMs(300)],
    timeColumn: 'time_ms',
    sampleInterval: { min: 100, max: 110 },
    minRows: 4,
  },
  gyroVersusHall('ph08-rpm-comparison'),
  mpuAccelG('ph09-friction-coefficients', [
    { label: 'block at rest', ...MPU_DEFAULT },
    { label: 'sliding on wood: μ = 0.25', x: -0.25, y: 0, z: 1 },
    { label: 'sliding on ice: μ = 0.125', x: -0.125, y: 0, z: 1 },
  ], accel100),
  gyroVersusHall('ph10-rotational-damping'),
  ...(['ph11-specific-heat', 'ph13-thermal-conductivity'] as const).map<Phase5BehaviorSpec>((recipeId) => ({
    recipeId,
    header: 'time_ms,index,temperature_c',
    phases: [
      {
        label: 'both probes at room temperature',
        steps: [waitSerial(',1,22.000')],
        expect: { index: { oneOf: [0, 1], tolerance: 0 }, temperature_c: approx(22, DS18B20_LSB_C) },
      },
      {
        label: recipeId === 'ph11-specific-heat' ? 'hot metal 60 °C, water 20 °C' : 'hot end 60 °C, cold end 20 °C',
        steps: [set('ds18b20_1', 'temperature', 60), set('ds18b20_2', 'temperature', 20), delayMs(3000)],
        expect: { index: { oneOf: [0, 1], tolerance: 0 }, temperature_c: { oneOf: [20, 60], tolerance: DS18B20_LSB_C } },
        settleRows: 2,
      },
      {
        label: 'equilibrium at 25 °C',
        steps: [set('ds18b20_1', 'temperature', 25), set('ds18b20_2', 'temperature', 25), delayMs(3000)],
        expect: { index: { oneOf: [0, 1], tolerance: 0 }, temperature_c: approx(25, DS18B20_LSB_C) },
        settleRows: 2,
      },
    ],
    checkRows: (rows) =>
      rows.flatMap((row, position) =>
        row.values.index === position % 2 ? [] : [`row ${position + 1}: index ${row.values.index}, expected ${position % 2}`]),
    minRows: 8,
  })),
  {
    recipeId: 'ph12-latent-heat',
    header: 'time_s,temperature_c',
    phases: [
      { label: 'ice from the freezer at -5 °C', steps: [set('ds18b20', 'temperature', -5), waitSerial(',-5.000')], expect: { temperature_c: approx(-5, DS18B20_LSB_C) } },
      // Melting: heat goes in, temperature stays at 0 °C.
      { label: 'melting plateau at 0 °C', steps: [set('ds18b20', 'temperature', 0), waitSerial(',0.000')], expect: { temperature_c: approx(0, DS18B20_LSB_C) } },
      { label: 'water warming to 5 °C', steps: [set('ds18b20', 'temperature', 5), waitSerial(',5.000')], expect: { temperature_c: approx(5, DS18B20_LSB_C) } },
    ],
    startupRows: 1,
    timeColumn: 'time_s',
    sampleInterval: { min: 1.6, max: 2.0 },
    minRows: 3,
  },
  ((): Phase5BehaviorSpec => {
    const raw = { ...BME280_DEFAULT_RAW }
    return {
      recipeId: 'ph14-insulation-performance',
      header: 'time_ms,object_temperature_c,ambient_temperature_c,humidity_pct',
      phases: [
        { celsius: 22, label: 'empty cup at room temperature' },
        { celsius: 60, label: 'hot water poured in' },
        { celsius: 50, label: 'cooled to 50 °C inside the insulation' },
      ].map(({ celsius, label }, index) => ({
        label,
        steps: [...(index === 0 ? [] : [set('ds18b20', 'temperature', celsius)]), waitSerial(`,${fixed(celsius, 3)},`)],
        expect: {
          object_temperature_c: approx(celsius, DS18B20_LSB_C),
          ambient_temperature_c: approx(bme280TemperatureC(raw.temperature), 0.011),
          humidity_pct: approx(bme280HumidityPct(raw.humidity, raw.temperature), 0.1),
        },
      })),
      finalSteps: [delayMs(500)],
      timeColumn: 'time_ms',
      sampleInterval: { min: 850, max: 1000 },
      minRows: 3,
    }
  })(),
  bmeRawDriver('ph15-gas-temperature-pressure', ['sealed flask at room temperature', 'flask warmed to 31 °C', 'gas compressed']),
  bmeRawDriver('ph16-altitude-pressure', ['ground floor', 'warmer upstairs air', 'carried up: pressure drops']),
  ((): Phase5BehaviorSpec => {
    // Ohm's law on a 1 kΩ resistor: the PWM average voltage across it, I = V / R.
    const ohms = 1000
    const duties = [26, 52, 78, 104, 130, 156, 182, 208, 234]
    const volts = (duty: number) => (5 * duty) / 255
    return {
      recipeId: 'ph17-ohms-law',
      header: 'condition_id,duty,bus_V,shunt_mV,current_mA',
      textColumns: ['condition_id'],
      phases: duties.map((duty, index) => {
        const { shunt, bus } = load(volts(duty), ohms)
        return {
          label: `duty ${duty}/255: ${volts(duty).toFixed(2)} V across 1 kΩ`,
          // Each row prints after its 800 ms settle; set the next level as soon as the previous row lands.
          steps: [
            ...(index === 0 ? [] : [waitSerial(`R1K,${duties[index - 1]},`)]),
            set('ina219', 'busRaw', bus),
            set('ina219', 'shuntRaw', shunt),
          ],
          expect: { duty: approx(duty, 0), bus_V: busVolts(bus), current_mA: current(shunt) },
        }
      }),
      finalSteps: [waitSerial('R1K,234,'), delayMs(200)],
      always: {
        condition_id: { text: 'R1K' },
        current_mA: derived(({ values }) => values.shunt_mV / 0.1, 0.002),
      },
      checkRows: (rows) =>
        rows.flatMap((row) => {
          const expected = (row.values.bus_V / ohms) * 1000
          return Math.abs(row.values.current_mA - expected) <= 0.06
            ? []
            : [`duty ${row.values.duty}: ${row.values.current_mA} mA at ${row.values.bus_V} V, Ohm's law says ${expected.toFixed(3)} mA`]
        }),
      minRows: 9,
    }
  })(),
  inaEquivalentResistance('ph18-series-parallel-resistance', [
    { label: '220 Ω and 1 kΩ in series: 1220 Ω', volts: 5, ohms: 1220 },
    { label: 'rewired in parallel: 180.3 Ω', volts: 5, ohms: (220 * 1000) / 1220 },
  ]),
  ((): Phase5BehaviorSpec => {
    // 220 Ω ∥ 470 Ω on 5 V, with the INA219 moved from the supply line to each branch in turn.
    const states = [
      { label: 'INA219 in the supply line: total current', ohms: (220 * 470) / 690 },
      { label: 'INA219 moved to the 220 Ω branch', ohms: 220 },
      { label: 'INA219 moved to the 470 Ω branch', ohms: 470 },
    ].map((state) => ({ ...state, ...load(5, state.ohms) }))
    return {
      recipeId: 'ph19-kirchhoff-laws',
      header: 'condition_id,time_ms,bus_V,shunt_mV,current_mA',
      textColumns: ['condition_id'],
      phases: states.map(({ label, shunt, bus }, index) => ({
        label,
        steps: [...inaSteps(index === 0 ? INA_DEFAULT : states[index - 1], { shunt, bus }), delayMs(1500)],
        expect: { bus_V: busVolts(bus), current_mA: current(shunt) },
        settleRows: index === 0 ? 0 : 1,
      })),
      startupRows: 1,
      always: { current_mA: derived(({ values }) => values.shunt_mV / 0.1, 0.002) },
      // Kirchhoff's current law: the branch currents add up to the total.
      checkRows: (rows) => {
        const [total, a, b] = states.map(({ shunt }) =>
          rows.find((row) => Math.abs(row.values.current_mA - ina219CurrentMa(shunt)) < 0.01)?.values.current_mA)
        if (total === undefined || a === undefined || b === undefined) return ['missing a total or branch reading']
        return Math.abs(total - (a + b)) <= 0.2 ? [] : [`total ${total} mA ≠ ${a} + ${b} mA`]
      },
      timeColumn: 'time_ms',
      sampleInterval: { min: 500, max: 520 },
      minRows: 6,
    }
  })(),
  ((): Phase5BehaviorSpec => {
    const heating = load(5, 10)
    return {
      recipeId: 'ph20-joule-heating',
      header: 'condition_id,time_ms,bus_V,current_mA,power_W,temperature_C',
      textColumns: ['condition_id'],
      phases: [
        {
          label: 'heater off, water at 22 °C',
          steps: [delayMs(2000)],
          expect: { bus_V: busVolts(INA_DEFAULT.bus), current_mA: current(INA_DEFAULT.shunt), temperature_C: approx(22, DS18B20_LSB_C) },
        },
        {
          label: '10 Ω heater on 5 V: 500 mA, 2.5 W',
          // A row takes 1.76 s; hold long enough for one full row before the water warms.
          steps: [...inaSteps(INA_DEFAULT, heating), delayMs(4000)],
          expect: { bus_V: busVolts(heating.bus), current_mA: current(heating.shunt), temperature_C: approx(22, DS18B20_LSB_C) },
          settleRows: 1,
        },
        {
          label: 'water heated to 30 °C',
          steps: [set('ds18b20', 'temperature', 30), delayMs(4000)],
          expect: { current_mA: current(heating.shunt), temperature_C: approx(30, DS18B20_LSB_C) },
          settleRows: 1,
        },
      ],
      always: {
        condition_id: { text: 'HEATING' },
        // P = V I
        power_W: derived(({ values }) => (values.bus_V * values.current_mA) / 1000, 0.0002),
      },
      timeColumn: 'time_ms',
      // 750 ms conversion inside the read + 1000 ms delay.
      sampleInterval: { min: 1750, max: 1900 },
      minRows: 4,
    }
  })(),
  {
    recipeId: 'ph21-rc-time-constant',
    header: 'condition_id,time_ms,capacitor_V,current_mA',
    textColumns: ['condition_id'],
    // The charging current through 10 kΩ from 5 V starts at 0.5 mA: five INA219 LSBs.
    phases: [0.5, 0.3, 0.1].map((milliamps, index) => ({
      label: `charging current ${milliamps} mA`,
      steps: [set('ina219', 'shuntRaw', shuntRawFor(milliamps)), delayMs(400)],
      expect: { current_mA: approx(milliamps, 0.0001) },
      settleRows: index === 0 ? 0 : 1,
    })),
    startupRows: 1,
    always: { condition_id: { text: 'CHARGE' }, capacitor_V: { min: 0, max: 5 } },
    timeColumn: 'time_ms',
    sampleInterval: { min: 50, max: 58 },
    minRows: 12,
  },
  ((): Phase5BehaviorSpec => {
    // A 1.5 V cell with 0.5 Ω internal resistance: V = E - I r.
    const open = { shunt: 0, bus: ina219BusRegisterFor(1.5) }
    const milliamps = (1.5 / 220.5) * 1000
    const loaded = { shunt: shuntRawFor(milliamps), bus: ina219BusRegisterFor(1.5 - (milliamps / 1000) * 0.5) }
    return {
      recipeId: 'ph22-battery-internal-resistance',
      header: 'condition_id,time_ms,terminal_V,current_mA',
      textColumns: ['condition_id'],
      phases: [
        { label: 'open circuit: E = 1.5 V', steps: [...inaSteps(INA_DEFAULT, open), delayMs(800)], expect: { terminal_V: busVolts(open.bus), current_mA: current(open.shunt) } },
        { label: '220 Ω load', steps: [...inaSteps(open, loaded), delayMs(800)], expect: { terminal_V: busVolts(loaded.bus), current_mA: current(loaded.shunt) }, settleRows: 1 },
      ],
      startupRows: 1,
      always: { condition_id: { text: 'R220' } },
      timeColumn: 'time_ms',
      sampleInterval: { min: 250, max: 265 },
      minRows: 5,
    }
  })(),
  ((): Phase5BehaviorSpec => {
    // Panel output follows the light on it.
    const states = [
      { label: 'full lamp on the panel', ch0: 4000, volts: 2, milliamps: 2 },
      { label: 'lamp dimmed to half', ch0: 2000, volts: 1.8, milliamps: 1.8 },
    ]
    return {
      recipeId: 'ph23-solar-iv-mpp',
      header: 'condition_id,time_ms,panel_V,current_mA,power_mW,light_raw',
      textColumns: ['condition_id'],
      phases: states.map(({ label, ch0, volts, milliamps }, index) => ({
        label,
        steps: [
          set('tsl2591', 'ch0Raw', ch0),
          set('ina219', 'busRaw', ina219BusRegisterFor(volts)),
          set('ina219', 'shuntRaw', shuntRawFor(milliamps)),
          delayMs(1500),
        ],
        expect: {
          panel_V: busVolts(ina219BusRegisterFor(volts)),
          current_mA: current(shuntRawFor(milliamps)),
          light_raw: approx(ch0, 0),
        },
        settleRows: index === 0 ? 0 : 1,
      })),
      startupRows: 1,
      always: {
        condition_id: { text: 'R1K' },
        power_mW: derived(({ values }) => values.panel_V * values.current_mA, 0.002),
      },
      timeColumn: 'time_ms',
      sampleInterval: { min: 500, max: 520 },
      minRows: 5,
    }
  })(),
  solenoid('ph24-solenoid-current-field', 'I050'),
  solenoid('ph25-coil-turns-field', 'N50'),
  rotatingMagnet('ph26-rotating-magnet-signal'),
  {
    recipeId: 'ph27-magnetic-shielding',
    header: 'time_ms,hall_raw',
    phases: [
      { label: 'magnet held near the sensor (0 V: south pole)', steps: [delayMs(400)], expect: { hall_raw: adc(0) } },
      { label: 'steel sheet slid between: field mostly shunted away', steps: [set('hbe0704', 'position', 0.4), delayMs(400)], expect: { hall_raw: adc(0.4) } },
      { label: 'sheet removed: full field again', steps: [set('hbe0704', 'position', 0), delayMs(400)], expect: { hall_raw: adc(0) } },
    ],
    timeColumn: 'time_ms',
    sampleInterval: { min: 100, max: 104 },
    minRows: 9,
  },
  tslRaw('ph28-malus-law', [
    // I = I0 cos² θ
    { label: 'polarisers aligned (0°)', ch0: 4000 },
    { label: 'rotated 45°: cos² = 1/2', ch0: 2000 },
    { label: 'crossed (90°): extinction', ch0: 0 },
  ]),
  tslRaw('ph29-transmittance-absorbance', [
    // I = I0 10^-A
    { label: 'blank cuvette (A = 0)', ch0: 4000 },
    { label: 'dye at A = 0.3', ch0: Math.round(4000 * 10 ** -0.3) },
    { label: 'dye at A = 1.0', ch0: 400 },
  ]),
  tslRaw('ph30-reflection-intensity-angle', [
    { label: 'incidence 15°', ch0: 1800 },
    { label: 'incidence 45°', ch0: 2600 },
    { label: 'incidence 75°: grazing reflection is strongest', ch0: 5200 },
  ]),
  tslRaw('ph31-lens-focal-length', [
    { label: 'screen inside the focus', ch0: 1500 },
    { label: 'screen at the focal point: brightest spot', ch0: 9000 },
    { label: 'screen past the focus', ch0: 1500 },
  ]),
  tslRaw('ph32-aperture-light', [
    // Light through a round hole grows with its area, d².
    { label: '2 mm hole', ch0: 500 },
    { label: '4 mm hole: 4x the area', ch0: 2000 },
    { label: '6 mm hole: 9x the area', ch0: 4500 },
  ]),
  tslRaw('ph33-light-source-stability', [
    { label: 'LED lamp, steady', ch0: 3000 },
    { label: 'incandescent warming up', ch0: 2600 },
    { label: 'incandescent settled', ch0: 2800 },
  ]),
  sonarMeters('ph34-torricelli-drain', [
    // The sensor looks down at the water surface; the gap grows as the tank drains.
    { label: 'full tank: surface 10 cm below the sensor', cm: 10 },
    { label: 'surface 15 cm below', cm: 15 },
    { label: 'surface 25 cm below', cm: 25 },
  ]),
  ((): Phase5BehaviorSpec => {
    const t0 = bme280TemperatureRawFor(0)
    const temperatures = [
      { label: 'wall 1 m away at 25.1 °C', cm: 100, raw: BME280_DEFAULT_RAW.temperature },
      { label: 'same wall, air cooled to 0 °C', cm: 100, raw: t0 },
    ]
    return {
      recipeId: 'ph35-temperature-speed-of-sound',
      header: 'time_ms,temperature_c,pressure_hpa,echo_time_us,distance_m',
      phases: temperatures.map(({ label, cm, raw }, index) => ({
        label,
        steps: [
          ...(index === 0 ? [set('hc-sr04', 'distance', cm)] : [set('bme280', 'temperatureRaw', raw)]),
          delayMs(800),
        ],
        expect: {
          temperature_c: approx(bme280TemperatureC(raw), 0.011),
          // The simulator times echoes at 58 µs/cm regardless of air temperature.
          echo_time_us: approx(cm * 58, cm * 58 * 0.015),
        },
        settleRows: index === 0 ? 0 : 1,
      })),
      startupRows: 1,
      always: {
        // d = t (331.3 + 0.606 T) / 2
        distance_m: derived(({ values }) => (values.echo_time_us * (331.3 + 0.606 * values.temperature_c)) / 2e6, 0.0005),
      },
      timeColumn: 'time_ms',
      sampleInterval: { min: 100, max: 130 },
      minRows: 8,
    }
  })(),
]

// ── Phase 7 ─────────────────────────────────────────────────────────────────

const phase7: Phase5BehaviorSpec[] = [
  ((): Phase5BehaviorSpec => {
    // LED light on the sensor grows in proportion to the PWM duty.
    const pwms = [0, 51, 102, 153, 204, 255]
    const ch0 = (pwm: number) => pwm * 40
    return {
      recipeId: 'a1-led-brightness',
      header: 'time_ms,pwm_value,light_raw',
      phases: pwms.map((pwm, index) => ({
        label: `PWM ${pwm}`,
        steps: [...(index === 0 ? [] : [waitSerial(`,${pwms[index - 1]},`)]), set('tsl2591', 'ch0Raw', ch0(pwm))],
        expect: { pwm_value: approx(pwm, 0), light_raw: approx(ch0(pwm), 0) },
      })),
      finalSteps: [waitSerial(',255,'), delayMs(200)],
      always: { light_raw: derived(({ values }) => ch0(values.pwm_value), 0) },
      timeColumn: 'time_ms',
      sampleInterval: { min: 2000, max: 2010 },
      minRows: 6,
    }
  })(),
  {
    recipeId: 'a2-buzzer-tone',
    header: 'time_ms,tone_hz,buzzer_on',
    phases: [{ label: 'beeping at 880 Hz, half a second on and off', steps: [delayMs(3000)], expect: { tone_hz: approx(880, 0) } }],
    checkRows: cycles('buzzer_on', [1, 0]),
    timeColumn: 'time_ms',
    // millis() lands a tick either side of the 500 ms delay.
    sampleInterval: { min: 495, max: 505 },
    minRows: 5,
  },
  {
    recipeId: 'a3-servo-angle',
    header: 'time_ms,commanded_deg',
    phases: [{ label: 'sweeping 0° to 180° in 30° steps', steps: [delayMs(8000)], expect: { commanded_deg: { min: 0, max: 180 } } }],
    checkRows: cycles('commanded_deg', [0, 30, 60, 90, 120, 150, 180]),
    timeColumn: 'time_ms',
    sampleInterval: { min: 995, max: 1005 },
    minRows: 7,
  },
  {
    recipeId: 'a4-relay-switch',
    header: 'time_ms,relay_state',
    phases: [
      {
        label: 'relay cycling 5 s on, 5 s off',
        steps: [
          waitSerial(',1'), expectPin('uno', '7', 1),
          waitSerial(',0'), expectPin('uno', '7', 0),
          waitSerial(',1'), expectPin('uno', '7', 1),
        ],
        expect: { relay_state: { oneOf: [0, 1], tolerance: 0 } },
      },
    ],
    checkRows: cycles('relay_state', [1, 0]),
    timeColumn: 'time_ms',
    sampleInterval: { min: 5000, max: 5005 },
    minRows: 3,
  },
  {
    recipeId: 'a5-dc-motor-drive',
    header: 'time_ms,direction,speed_value',
    textColumns: ['direction'],
    phases: [
      {
        label: 'forward, stop, reverse, stop',
        // IN1/IN2 pick the direction; ENA at 0 stops the motor.
        steps: [
          waitSerial(',forward,'), expectPin('uno', '2', 1), expectPin('uno', '4', 0),
          waitSerial(',stop,'), expectPin('uno', '5', 0),
          waitSerial(',reverse,'), expectPin('uno', '2', 0), expectPin('uno', '4', 1),
          waitSerial(',stop,'), expectPin('uno', '5', 0),
        ],
        expect: { speed_value: { oneOf: [0, 160], tolerance: 0 } },
      },
    ],
    finalSteps: [delayMs(100)],
    checkRows: (rows) => {
      const sequence = rows.map((row) => `${row.cells.direction}:${row.values.speed_value}`)
      const expected = ['forward:160', 'stop:0', 'reverse:160', 'stop:0']
      return sequence.every((step, index) => step === expected[index % 4]) ? [] : [`sequence ${sequence.join(' → ')}`]
    },
    minRows: 4,
  },
  {
    recipeId: 'a6-lcd-display',
    header: 'time_ms,temperature_c',
    phases: [
      { label: 'tap water at 22 °C', steps: [waitSerial(',22.00')], expect: { temperature_c: approx(22, DS18B20_LSB_C) } },
      { label: 'warm water at 40 °C', steps: [set('ds18b20', 'temperature', 40), waitSerial(',40.00')], expect: { temperature_c: approx(40, DS18B20_LSB_C) } },
    ],
    timeColumn: 'time_ms',
    sampleInterval: { min: 1000, max: 1900 },
    minRows: 2,
  },
  ((): Phase5BehaviorSpec => {
    // Fermenting yeast warms the water and its CO2 raises the jar's pressure.
    const before: BmeRaw = { ...BME280_DEFAULT_RAW }
    const after: BmeRaw = { ...BME280_DEFAULT_RAW, pressure: 410000 }
    return {
      recipeId: 'b1-yeast-fermentation',
      header: 'time_ms,water_c,pressure_hpa',
      phases: [
        { label: 'sealed jar, 22 °C', steps: [delayMs(3000)], expect: { water_c: approx(22, DS18B20_LSB_C), pressure_hpa: bmeP(before) } },
        {
          label: 'fermenting: 30 °C, pressure rising',
          steps: [set('ds18b20', 'temperature', 30), ...bmeSteps('bme280', before, after), delayMs(5000)],
          expect: { water_c: approx(30, DS18B20_LSB_C), pressure_hpa: bmeP(after) },
          settleRows: 1,
        },
      ],
      timeColumn: 'time_ms',
      sampleInterval: { min: 2000, max: 2900 },
      minRows: 3,
    }
  })(),
  ((): Phase5BehaviorSpec => {
    const t = BME280_DEFAULT_RAW.temperature
    const transpiring: BmeRaw = { ...BME280_DEFAULT_RAW, humidity: bme280HumidityRawFor(70, t) }
    return {
      recipeId: 'b2-leaf-transpiration',
      header: 'time_ms,temperature_c,humidity_pct',
      phases: [
        { label: 'bag sealed over the leaf', steps: [delayMs(6000)], expect: { temperature_c: bmeT(BME280_DEFAULT_RAW), humidity_pct: bmeH(BME280_DEFAULT_RAW) } },
        {
          label: 'transpired water: 70 %RH',
          steps: [...bmeSteps('bme280', BME280_DEFAULT_RAW, transpiring), delayMs(10000)],
          expect: { temperature_c: bmeT(transpiring), humidity_pct: bmeH(transpiring) },
        },
      ],
      timeColumn: 'time_ms',
      sampleInterval: { min: 5000, max: 5060 },
      minRows: 4,
    }
  })(),
  ((): Phase5BehaviorSpec => {
    const lit: BmeRaw = { ...BME280_DEFAULT_RAW, pressure: 410000 }
    return {
      recipeId: 'b3-photosynthesis-pressure',
      header: 'time_ms,lux,pressure_hpa,temperature_c',
      phases: [
        {
          label: 'jar in the dark corner',
          steps: [delayMs(6000)],
          expect: { lux: lux(TSL2591_DEFAULT_RAW.ch0, TSL2591_DEFAULT_RAW.ch1, TSL2591_GAIN.low), pressure_hpa: bmeP(BME280_DEFAULT_RAW), temperature_c: bmeT(BME280_DEFAULT_RAW) },
        },
        {
          label: 'under the lamp: oxygen raises the pressure',
          steps: [
            set('tsl2591', 'ch0Raw', TSL2591_DEFAULT_RAW.ch0 * 3),
            set('tsl2591', 'ch1Raw', TSL2591_DEFAULT_RAW.ch1 * 3),
            ...bmeSteps('bme280', BME280_DEFAULT_RAW, lit),
            delayMs(10000),
          ],
          expect: { lux: lux(TSL2591_DEFAULT_RAW.ch0 * 3, TSL2591_DEFAULT_RAW.ch1 * 3, TSL2591_GAIN.low), pressure_hpa: bmeP(lit), temperature_c: bmeT(lit) },
        },
      ],
      timeColumn: 'time_ms',
      sampleInterval: { min: 5100, max: 5200 },
      minRows: 4,
    }
  })(),
  {
    recipeId: 'b4-reaction-time',
    header: 'time_ms,reaction_ms,distance_cm',
    phases: [
      {
        // Nobody reaches in: the sketch gives up 3 s after the LED lights.
        label: 'no hand: the 3 s timeout',
        steps: [waitSerial(',')],
        expect: { reaction_ms: { min: 3000, max: 3030 }, distance_cm: echoCm(400) },
      },
      {
        label: 'hand already 10 cm from the sensor when the LED lights',
        steps: [set('hc-sr04', 'distance', 10), delayMs(8500)],
        expect: { reaction_ms: { min: 0, max: 40 }, distance_cm: echoCm(10) },
      },
    ],
    minRows: 2,
  },
  mpuNorm('b5-step-counter', ['standing still', 'heel strike: 1.5 g', 'heel strike with a forward lurch']),
  {
    recipeId: 'b6-skin-temperature-recovery',
    header: 'time_ms,skin_c,dynamic_g',
    phases: [
      { label: 'probe in room air', steps: [waitSerial(',22.00,0.0000')], expect: { skin_c: approx(22, DS18B20_LSB_C), dynamic_g: approx(0, 0.0002) } },
      { label: 'taped to the skin: 33 °C', steps: [set('ds18b20', 'temperature', 33), waitSerial(',33.00,0.0000')], expect: { skin_c: approx(33, DS18B20_LSB_C), dynamic_g: approx(0, 0.0002) } },
      { label: 'exercising: 1.5 g', steps: [set('mpu6050', 'accelZ', 1.5), waitSerial(',33.00,0.5000')], expect: { skin_c: approx(33, DS18B20_LSB_C), dynamic_g: approx(0.5, 0.0002) } },
    ],
    timeColumn: 'time_ms',
    sampleInterval: { min: 1000, max: 1900 },
    minRows: 3,
  },
  {
    recipeId: 'b8-seed-germination-gdd',
    header: 'time_ms,temperature_c',
    // One reading a minute, so a single one fits in the run.
    phases: [{ label: 'seed tray at 22 °C', steps: [waitSerial(',22.00')], expect: { temperature_c: approx(22, DS18B20_LSB_C) } }],
    finalSteps: [delayMs(200)],
    minRows: 1,
  },
  ((): Phase5BehaviorSpec => {
    const humid: BmeRaw = { ...BME280_DEFAULT_RAW, humidity: bme280HumidityRawFor(60) }
    return {
      recipeId: 'c1-wet-dry-humidity',
      header: 'time_ms,dry_c,wet_c,humidity_pct',
      phases: [
        {
          label: 'both bulbs dry at 22 °C',
          steps: [delayMs(3000)],
          expect: { dry_c: approx(22, DS18B20_LSB_C), wet_c: approx(22, DS18B20_LSB_C), humidity_pct: bmeH(BME280_DEFAULT_RAW) },
        },
        {
          // Evaporation cools the wet bulb; at 60 %RH and 25 °C it reads about 19.5 °C.
          label: 'wick wetted: dry 25 °C, wet 19.5 °C, 60 %RH',
          steps: [
            set('ds18b20_1', 'temperature', 25),
            set('ds18b20_2', 'temperature', 19.5),
            ...bmeSteps('bme280', BME280_DEFAULT_RAW, humid),
            delayMs(5000),
          ],
          expect: {
            dry_c: { oneOf: [25, 19.5], tolerance: DS18B20_LSB_C },
            wet_c: { oneOf: [25, 19.5], tolerance: DS18B20_LSB_C },
            humidity_pct: bmeH(humid),
          },
          settleRows: 1,
        },
      ],
      checkRows: twoProbesEitherOrder(['dry_c', 'wet_c'], [[25, 19.5]]),
      timeColumn: 'time_ms',
      sampleInterval: { min: 2000, max: 2900 },
      minRows: 3,
    }
  })(),
  dallasSingle('c2-freezing-point-depression', 'temperature_c', [
    { label: 'salt water at 5 °C', celsius: 5 },
    { label: 'supercooled to -3 °C', celsius: -3 },
    { label: 'freezing plateau at -2 °C (depressed by the salt)', celsius: -2 },
  ], 2000),
  ((): Phase5BehaviorSpec => {
    return {
      recipeId: 'c3-turbidity-precipitation',
      header: 'time_ms,light_raw,transmittance_pct',
      phases: [
        { label: 'clear water: the 100 % baseline', steps: [delayMs(800)], expect: { light_raw: approx(TSL2591_DEFAULT_RAW.ch0, 0), transmittance_pct: approx(100, 0.005) } },
        { label: 'precipitate forming: half the light', steps: [set('tsl2591', 'ch0Raw', 617), delayMs(1200)], expect: { light_raw: approx(617, 0) }, settleRows: 1 },
        { label: 'dense precipitate', steps: [set('tsl2591', 'ch0Raw', 123), delayMs(1200)], expect: { light_raw: approx(123, 0) }, settleRows: 1 },
      ],
      always: {
        // Relative to the clear-water reading taken in setup().
        transmittance_pct: derived(({ values }) => (100 * values.light_raw) / TSL2591_DEFAULT_RAW.ch0, 0.006),
      },
      timeColumn: 'time_ms',
      sampleInterval: { min: 610, max: 680 },
      minRows: 5,
    }
  })(),
  dallasSingle('c4-neutralization-endpoint', 'temperature_c', [
    { label: 'acid at 22 °C', celsius: 22 },
    { label: 'base added: warming to 25 °C', celsius: 25 },
    { label: 'past the endpoint: cooling to 24 °C', celsius: 24 },
  ], 1000),
  ((): Phase5BehaviorSpec => {
    // A surface reflects a fixed fraction of the LED light: reflected ∝ PWM level.
    const levels = [85, 170, 255]
    const ch0 = (level: number) => level * 4
    return {
      recipeId: 'c5-surface-albedo',
      header: 'time_ms,pwm_value,reflected_raw',
      phases: levels.map((level, index) => ({
        label: `LED at ${level}/255`,
        steps: [...(index === 0 ? [] : [waitSerial(`,${levels[index - 1]},`)]), set('tsl2591', 'ch0Raw', ch0(level))],
        expect: { pwm_value: approx(level, 0) },
      })),
      finalSteps: [waitSerial(',255,'), delayMs(200)],
      // MEDIUM gain (25x): albedo = reflected / incident is the same at every level.
      always: { reflected_raw: derived(({ values }) => ch0(values.pwm_value) * TSL2591_GAIN.medium, 0) },
      timeColumn: 'time_ms',
      sampleInterval: { min: 3100, max: 3160 },
      minRows: 3,
    }
  })(),
  {
    recipeId: 'c6-soil-water-heat-capacity',
    header: 'time_ms,soil_c,water_c',
    phases: [
      {
        label: 'soil and water cups at room temperature',
        steps: [delayMs(6000)],
        expect: { soil_c: approx(22, DS18B20_LSB_C), water_c: approx(22, DS18B20_LSB_C) },
      },
      {
        // Same lamp, lower heat capacity: the soil warms faster than the water.
        label: 'under the lamp: soil 30 °C, water 24 °C',
        steps: [set('ds18b20_1', 'temperature', 30), set('ds18b20_2', 'temperature', 24), delayMs(10000)],
        expect: {
          soil_c: { oneOf: [30, 24], tolerance: DS18B20_LSB_C },
          water_c: { oneOf: [30, 24], tolerance: DS18B20_LSB_C },
        },
      },
    ],
    checkRows: twoProbesEitherOrder(['soil_c', 'water_c'], [[30, 24]]),
    timeColumn: 'time_ms',
    sampleInterval: { min: 5000, max: 5900 },
    minRows: 3,
  },
  {
    recipeId: 'c7-photobleaching',
    header: 'time_ms,light_raw,baseline_raw',
    phases: [
      { label: 'dye freshly mixed', steps: [delayMs(1500)], expect: { light_raw: approx(TSL2591_DEFAULT_RAW.ch0, 0) } },
      { label: 'dye bleached: more light gets through', steps: [set('tsl2591', 'ch0Raw', 1800), delayMs(11000)], expect: { light_raw: approx(1800, 0) } },
    ],
    always: { baseline_raw: approx(TSL2591_DEFAULT_RAW.ch0, 0) },
    timeColumn: 'time_ms',
    sampleInterval: { min: 10100, max: 10160 },
    minRows: 2,
  },
  ((): Phase5BehaviorSpec => {
    const before = { ...BME280_DEFAULT_RAW }
    return {
      recipeId: 'c8-ventilation-recovery',
      header: 'time_ms,temperature_c,humidity_pct,fan',
      // The fan only switches after two minutes of baseline; this run covers the baseline.
      phases: [{ label: 'baseline before ventilating: fan off', steps: [delayMs(16000), expectPin('uno', '7', 0)], expect: { temperature_c: bmeT(before), humidity_pct: bmeH(before), fan: approx(0, 0) } }],
      timeColumn: 'time_ms',
      sampleInterval: { min: 5000, max: 5060 },
      minRows: 4,
    }
  })(),
  ((): Phase5BehaviorSpec => {
    // Closed loop: 4 passes/s is 240 rpm against a 120 rpm target, so the drive backs off.
    return {
      recipeId: 'd1-motor-speed-control',
      header: 'time_ms,rpm,speed_value,rpm_error',
      phases: [
        { label: 'wheel stalled: drive ramps up', steps: [set('hbe0704', 'position', 0.5), delayMs(3000)], expect: { rpm: { min: 0, max: 60 } } },
        {
          label: 'wheel overspeeding at 240 rpm: drive ramps down',
          steps: Array.from({ length: 16 }, () => [set('hbe0704', 'position', 1), delayMs(125), set('hbe0704', 'position', 0.5), delayMs(125)]).flat(),
          expect: { rpm: { min: 180, max: 300 } },
          settleRows: 1,
        },
      ],
      always: {
        rpm_error: derived(({ values }) => 120 - values.rpm, 0),
        // +5 when below target, -5 above, starting from 150, clamped to 0..255.
        speed_value: derived((row, previous) => {
          const before = previous.length === 0 ? 150 : previous[previous.length - 1].values.speed_value
          return Math.min(255, Math.max(0, before + (row.values.rpm_error > 0 ? 5 : -5)))
        }, 0),
      },
      timeColumn: 'time_ms',
      sampleInterval: { min: 1000, max: 1003 },
      minRows: 6,
    }
  })(),
  {
    recipeId: 'd2-digital-level',
    header: 'time_ms,roll_deg,pitch_deg',
    phases: [
      { label: 'level on the table', steps: [waitSerial(',0.00,0.00')], expect: { roll_deg: approx(0, 0.02), pitch_deg: approx(0, 0.02) } },
      { label: 'rolled 45°', steps: [set('mpu6050', 'accelY', 1), waitSerial(',45.00,0.00')], expect: { roll_deg: approx(45, 0.02), pitch_deg: approx(0, 0.02) }, settleRows: 1 },
      {
        label: 'then pitched',
        steps: [set('mpu6050', 'accelX', -1), waitSerial(',45.00,35.26')],
        expect: { roll_deg: approx(45, 0.02), pitch_deg: approx((Math.atan2(1, Math.SQRT2) * 180) / Math.PI, 0.02) },
        settleRows: 1,
      },
    ],
    finalSteps: [delayMs(300)],
    minRows: 4,
  },
  {
    recipeId: 'd4-parking-barrier',
    header: 'time_ms,distance_cm,door_state,buzzer_on',
    // Opens below 20 cm, closes above 25 cm; buzzes below 10 cm.
    phases: [
      { cm: 400, door: 0, buzzer: 0, label: 'no car' },
      { cm: 15, door: 1, buzzer: 0, label: 'car at 15 cm: barrier opens' },
      { cm: 5, door: 1, buzzer: 1, label: 'car too close: buzzer' },
      { cm: 22, door: 1, buzzer: 0, label: 'car backs to 22 cm: inside the hysteresis band, stays open' },
      { cm: 30, door: 0, buzzer: 0, label: 'car leaves past 25 cm: barrier closes' },
    ].map(({ cm, door, buzzer, label }, index) => ({
      label,
      steps: [...(index === 0 ? [] : [set('hc-sr04', 'distance', cm)]), delayMs(600)],
      expect: { distance_cm: echoCm(cm), door_state: approx(door, 0), buzzer_on: approx(buzzer, 0) },
    })),
    minRows: 15,
  },
  {
    recipeId: 'd5-auto-curtain',
    header: 'time_ms,lux,commanded_deg',
    // Opens above 300 lux, closes below 150 lux.
    phases: [
      { ch0: TSL2591_DEFAULT_RAW.ch0, ch1: TSL2591_DEFAULT_RAW.ch1, angle: 120, label: 'bright morning: open' },
      { ch0: 88, ch1: 22, angle: 120, label: 'cloud at ~200 lux: inside the band, stays open' },
      { ch0: 44, ch1: 11, angle: 0, label: 'dusk at ~100 lux: closes' },
      { ch0: 88, ch1: 22, angle: 0, label: 'back to ~200 lux: stays closed' },
      { ch0: 176, ch1: 44, angle: 120, label: '~400 lux: opens again' },
    ].map(({ ch0, ch1, angle, label }, index) => ({
      label,
      steps: [...(index === 0 ? [] : [set('tsl2591', 'ch0Raw', ch0), set('tsl2591', 'ch1Raw', ch1)]), delayMs(2500)],
      expect: { lux: lux(ch0, ch1, TSL2591_GAIN.medium), commanded_deg: approx(angle, 0) },
      settleRows: index === 0 ? 0 : 1,
    })),
    timeColumn: 'time_ms',
    sampleInterval: { min: 1110, max: 1170 },
    minRows: 10,
  },
  {
    recipeId: 'd6-temperature-alarm',
    header: 'time_ms,temperature_c,alarm_state',
    // On above 30 °C, off below 29 °C.
    phases: [
      { celsius: 25, alarm: 0 as const, label: 'greenhouse at 25 °C' },
      { celsius: 31, alarm: 1 as const, label: 'overheating at 31 °C: alarm' },
      { celsius: 29.5, alarm: 1 as const, label: 'cooling to 29.5 °C: inside the band, still alarming' },
      { celsius: 28.5, alarm: 0 as const, label: 'below 29 °C: alarm clears' },
    ].map(({ celsius, alarm, label }) => ({
      label,
      steps: [set('ds18b20', 'temperature', celsius), waitSerial(`,${fixed(celsius, 2)},${alarm}`), expectPin('uno', '9', alarm)],
      expect: { temperature_c: approx(celsius, DS18B20_LSB_C), alarm_state: approx(alarm, 0) },
    })),
    startupRows: 1,
    timeColumn: 'time_ms',
    sampleInterval: { min: 1000, max: 1900 },
    minRows: 4,
  },
  {
    recipeId: 'd7-vibration-alarm',
    header: 'time_ms,dynamic_g,alarm_state',
    phases: [
      { label: 'door still', steps: [waitSerial(',0.0000,0')], expect: { dynamic_g: approx(0, 0.0002), alarm_state: approx(0, 0) } },
      { label: 'door knocked: 0.2 g', steps: [set('mpu6050', 'accelZ', 1.2), waitSerial(',0.2000,1')], expect: { dynamic_g: approx(accelG(1.2) - 1, 0.0002), alarm_state: approx(1, 0) } },
      { label: 'still again, alarm held for 3 s', steps: [set('mpu6050', 'accelZ', 1), waitSerial(',0.0000,1')], expect: { dynamic_g: approx(0, 0.0002), alarm_state: approx(1, 0) } },
      { label: 'hold expired', steps: [delayMs(3300)], expect: { dynamic_g: approx(0, 0.0002), alarm_state: approx(0, 0) } },
    ],
    checkRows: (rows) => {
      const lastKnock = [...rows].reverse().find((row) => row.values.dynamic_g > 0.08)
      const cleared = rows.find((row) => lastKnock && row.values.time_ms > lastKnock.values.time_ms && row.values.alarm_state === 0)
      if (!lastKnock || !cleared) return ['alarm never cleared after the knock']
      const held = cleared.values.time_ms - lastKnock.values.time_ms
      return held >= 2990 && held <= 3100 ? [] : [`alarm held ${held} ms after the knock, expected 3000`]
    },
    timeColumn: 'time_ms',
    sampleInterval: { min: 50, max: 56 },
    minRows: 20,
  },
  {
    recipeId: 'd8-elevator-floor',
    header: 'time_ms,distance_cm,floor_index,commanded_deg',
    // floor = round(cm / 8); the door opens only within half a floor of the bottom.
    phases: [
      { cm: 3, floor: 0, angle: 90, label: 'car at the ground floor: door open' },
      { cm: 17, floor: 2, angle: 0, label: 'car at floor 2' },
      { cm: 40, floor: 5, angle: 0, label: 'car at floor 5' },
    ].map(({ cm, floor, angle, label }) => ({
      label,
      steps: [set('hc-sr04', 'distance', cm), delayMs(1200)],
      expect: { distance_cm: echoCm(cm), floor_index: approx(floor, 0), commanded_deg: approx(angle, 0) },
      settleRows: 1,
    })),
    startupRows: 1,
    minRows: 8,
  },
  {
    recipeId: 'e1-terminal-velocity',
    header: 'time_ms,distance_cm',
    phases: [400, 200, 50].map((cm, index) => ({
      label: index === 0 ? 'coffee filter released 4 m up' : `falling past ${cm} cm`,
      steps: [...(index === 0 ? [] : [set('hc-sr04', 'distance', cm)]), delayMs(400)],
      expect: { distance_cm: echoCm(cm) },
    })),
    timeColumn: 'time_ms',
    sampleInterval: { min: 50, max: 51 },
    minRows: 15,
  },
  mpuNorm('e2-pendulum-damping', ['pendulum hanging still', 'passing the bottom: 1.5 g', 'swinging with a sideways push']),
  {
    recipeId: 'e3-moment-of-inertia',
    header: 'time_ms,gyro_z_dps',
    phases: [
      { label: 'turntable at rest', steps: [waitSerial(',0.000')], expect: { gyro_z_dps: approx(0, 0.01) } },
      { label: 'spun at 90 °/s', steps: [set('mpu6050', 'rotationZ', 90), waitSerial(',90.000')], expect: { gyro_z_dps: approx(90, 0.01) } },
      { label: 'spun the other way at 200 °/s', steps: [set('mpu6050', 'rotationZ', -200), waitSerial(',-200.000')], expect: { gyro_z_dps: approx(-200, 0.01) } },
    ],
    finalSteps: [delayMs(300)],
    timeColumn: 'time_ms',
    sampleInterval: { min: 20, max: 21 },
    minRows: 10,
  },
]

export const phase67BehaviorSpecs: readonly Phase5BehaviorSpec[] = [...phase6, ...phase7]
