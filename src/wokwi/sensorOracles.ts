/**
 * Datasheet conversions from a simulated sensor's raw reading to the physical
 * quantity a correct sketch must report. These are written from the vendor
 * documents, not from the recipe sketches, so a sketch that converts wrongly
 * disagrees with them.
 */

/**
 * BME280 calibration words the custom chip serves (chips/bme280.c). T1-T3 and
 * P1-P9 are the worked-example trimming values from the Bosch datasheet.
 */
export const BME280_CALIBRATION = {
  T1: 27504, T2: 26435, T3: -1000,
  P1: 36477, P2: -10685, P3: 3024, P4: 2855, P5: 140, P6: -7, P7: 15500, P8: -14600, P9: 6000,
  H1: 75, H2: 362, H3: 0, H4: 334, H5: 50, H6: 30,
} as const

/** Power-on raw ADC values of the custom chip's controls (chips/bme280.chip.c). */
export const BME280_DEFAULT_RAW = { temperature: 519888, pressure: 415148, humidity: 30000 } as const

const C = BME280_CALIBRATION

/** Bosch datasheet §8.1 double-precision compensation. */
export function bme280TFine(adcT: number): number {
  const var1 = (adcT / 16384 - C.T1 / 1024) * C.T2
  const var2 = (adcT / 131072 - C.T1 / 8192) ** 2 * C.T3
  return var1 + var2
}

export const bme280TemperatureC = (adcT: number) => bme280TFine(adcT) / 5120

export function bme280PressureHpa(adcP: number, adcT: number): number {
  let var1 = bme280TFine(adcT) / 2 - 64000
  let var2 = (var1 * var1 * C.P6) / 32768
  var2 += var1 * C.P5 * 2
  var2 = var2 / 4 + C.P4 * 65536
  var1 = ((C.P3 * var1 * var1) / 524288 + C.P2 * var1) / 524288
  var1 = (1 + var1 / 32768) * C.P1
  let p = 1048576 - adcP
  p = ((p - var2 / 4096) * 6250) / var1
  var1 = (C.P9 * p * p) / 2147483648
  var2 = (p * C.P8) / 32768
  return (p + (var1 + var2 + C.P7) / 16) / 100
}

export function bme280HumidityPct(adcH: number, adcT: number): number {
  let h = bme280TFine(adcT) - 76800
  h = (adcH - (C.H4 * 64 + (C.H5 / 16384) * h))
    * ((C.H2 / 65536) * (1 + (C.H6 / 67108864) * h * (1 + (C.H3 / 67108864) * h)))
  h *= 1 - (C.H1 * h) / 524288
  return Math.min(100, Math.max(0, h))
}

/** Smallest raw reading whose converted value reaches `target` (monotonic search). */
function rawFor(target: number, convert: (raw: number) => number, max: number): number {
  let low = 0
  let high = max
  const rising = convert(max) > convert(0)
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (rising ? convert(middle) < target : convert(middle) > target) low = middle + 1
    else high = middle
  }
  return low
}

export const bme280TemperatureRawFor = (celsius: number) => rawFor(celsius, bme280TemperatureC, 0xfffff)
export const bme280HumidityRawFor = (percent: number, adcT: number = BME280_DEFAULT_RAW.temperature) =>
  rawFor(percent, (raw) => bme280HumidityPct(raw, adcT), 0xffff)

/** International barometric formula, as the weather recipe states it. */
export const barometricAltitudeM = (pressureHpa: number, seaLevelHpa: number) =>
  44330 * (1 - (pressureHpa / seaLevelHpa) ** 0.1903)

/** TSL2591 ADC gain per CONTROL setting (datasheet Table 6, typical). */
export const TSL2591_GAIN = { low: 1, medium: 25, high: 428, max: 9876 } as const
/** Power-on raw counts of the custom chip's controls (chips/tsl2591.chip.c). */
export const TSL2591_DEFAULT_RAW = { ch0: 1234, ch1: 321 } as const

/**
 * Lux for the light that produces `ch0Raw`/`ch1Raw` counts at 1x gain and 100 ms,
 * read at `gain` with 100 ms integration: the counts scale with gain until the
 * 16-bit ADC saturates (reported as -1), and the DF=408 lux equation (the
 * Adafruit/ams application-note form) divides that gain back out.
 */
export function tsl2591Lux(ch0Raw: number, ch1Raw: number, gain: number): number {
  const ch0 = Math.min(0xffff, ch0Raw * gain)
  const ch1 = Math.min(0xffff, ch1Raw * gain)
  if (ch0 === 0xffff || ch1 === 0xffff) return -1
  const countsPerLux = (100 * gain) / 408
  return ((ch0 - ch1) * (1 - ch1 / ch0)) / countsPerLux
}

/** INA219 with the 0.1 Ω shunt every breakout carries; shunt register LSB is 10 µV. */
export const ina219CurrentMa = (shuntRaw: number) => (shuntRaw * 10e-6 / 0.1) * 1000
/** Bus voltage register: 4 mV per LSB in bits 15:3. */
export const ina219BusVolts = (busRegister: number) => (busRegister >> 3) * 0.004
export const ina219BusRegisterFor = (volts: number) => Math.round(volts / 0.004) << 3
