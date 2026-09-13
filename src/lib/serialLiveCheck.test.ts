import { describe, expect, it } from 'vitest'
import { buildAnalysisParams, checkReceivedLines, describeSilence, parseRecipeHint } from './serialLiveCheck'
import { MIN_LIVE_ROWS } from '@/recipes/firstReading'

function rows(header: string, makeRow: (index: number) => string, count = MIN_LIVE_ROWS) {
  return [header, ...Array.from({ length: count }, (_, index) => makeRow(index))]
}

describe('buildAnalysisParams', () => {
  it('속도·코드의 열 이름·센서를 링크에 싣고, 열 이름을 못 찾으면 비워 둔다', () => {
    const sketch = 'void setup(){Serial.begin(9600);Serial.println("time_ms,temperature_c");}'
    const params = new URLSearchParams(buildAnalysisParams({ id: 'cooling', title: '물의 냉각 곡선', baudRate: 9600, sketch, sensors: ['ds18b20', 'ds18b20'] }))
    expect(params.get('recipe')).toBe('cooling')
    expect(params.get('title')).toBe('물의 냉각 곡선')
    expect(params.get('baud')).toBe('9600')
    expect(params.get('header')).toBe('time_ms,temperature_c')
    expect(params.get('sensors')).toBe('ds18b20')
    expect(parseRecipeHint(params)).toEqual({
      expectedHeader: ['time_ms', 'temperature_c'],
      sensors: ['ds18b20'],
      recipeId: 'cooling',
      title: '물의 냉각 곡선',
    })

    const bare = new URLSearchParams(buildAnalysisParams({ id: 'x', title: 'X', baudRate: 115200, sketch: 'void setup(){}', sensors: [] }))
    expect(bare.get('header')).toBeNull()
    expect(bare.get('sensors')).toBeNull()
    expect(parseRecipeHint(bare)).toEqual({ expectedHeader: null, sensors: [], recipeId: 'x', title: 'X' })
    expect(parseRecipeHint(new URLSearchParams('baud=9600'))).toBeNull()
  })
})

describe('parseRecipeHint', () => {
  it('열 이름과 센서를 읽고, 둘 다 없으면 기준이 없다고 답한다', () => {
    expect(parseRecipeHint(new URLSearchParams('header=time_ms%2Ctemperature_c&sensors=ds18b20'))).toEqual({
      expectedHeader: ['time_ms', 'temperature_c'],
      sensors: ['ds18b20'],
    })
    expect(parseRecipeHint(new URLSearchParams('sensors=bme280'))).toEqual({ expectedHeader: null, sensors: ['bme280'] })
    expect(parseRecipeHint(new URLSearchParams('baud=9600'))).toBeNull()
  })
})

describe('checkReceivedLines', () => {
  const ds18b20 = { expectedHeader: ['time_ms', 'temperature_c'], sensors: ['ds18b20'] }

  it('열 이름이 레시피 코드와 다르면 다른 코드가 올라가 있다고 알린다', () => {
    const result = checkReceivedLines(ds18b20, rows('time_ms,distance_cm', (i) => `${i * 100},${12 + i}`))
    expect(result.headerMismatch).toContain('time_ms, distance_cm')
    expect(result.headerMismatch).toContain('다른 레시피의 코드')
    expect(result.signals).toEqual([])
  })

  it('열 이름이 같고 값이 정상이면 아무 말도 하지 않는다', () => {
    const result = checkReceivedLines(ds18b20, rows('time_ms,temperature_c', (i) => `${i * 1000},${21.5 + i * 0.1}`))
    expect(result).toEqual({ deviceErrors: [], headerMismatch: null, signals: [] })
  })

  it('보드가 찍은 오류 줄은 레시피 기준이 없어도, 값 행이 없어도 알린다', () => {
    const result = checkReceivedLines(null, ['# BME280_ERROR', '# BME280_ERROR', 'time_ms,temperature_c'])
    expect(result.deviceErrors).toEqual(['# BME280_ERROR'])
    expect(result.headerMismatch).toBeNull()
  })

  it('라이브러리가 nan을 찍으면 센서를 찾지 못했다고 알린다', () => {
    const hint = { expectedHeader: null, sensors: ['bme280'] }
    const result = checkReceivedLines(hint, rows('time_ms,temperature_c,humidity_pct', (i) => `${i},nan,nan`))
    expect(result.signals.map((signal) => signal.sign)).toEqual(['nan이 나옵니다'])
  })

  it('빈 칸은 0으로 읽지 않는다', () => {
    const hint = { expectedHeader: null, sensors: ['hc-sr04'] }
    const result = checkReceivedLines(hint, rows('time_ms,distance_cm', (i) => `${i},`))
    expect(result.signals).toEqual([])
  })

  it('DS18B20이 -127.00만 보내면 센서를 찾지 못했다고 알린다', () => {
    const result = checkReceivedLines(ds18b20, rows('time_ms,temperature_c', (i) => `${i * 1000},-127.00`))
    expect(result.signals.map((signal) => signal.sign)).toEqual(['-127.00이 나옵니다'])
  })

  it('행이 아직 적으면 판단하지 않는다', () => {
    const result = checkReceivedLines(ds18b20, rows('time_ms,temperature_c', (i) => `${i * 1000},-127.00`, MIN_LIVE_ROWS - 1))
    expect(result.signals).toEqual([])
  })

  it('시간·상태·횟수 열이 0에 붙어 있어도 고장으로 보지 않는다', () => {
    const hint = { expectedHeader: null, sensors: ['hc-sr04', 'tsl2591'] }
    const result = checkReceivedLines(hint, rows('time_ms,distance_cm,door_state,pulse_count', (i) => `${i * 100},${30 + i},0,0`))
    expect(result.signals).toEqual([])
  })

  it('레시피가 쓰지 않는 센서의 신호는 보지 않는다', () => {
    const hint = { expectedHeader: null, sensors: ['mpu6050'] }
    const result = checkReceivedLines(hint, rows('time_ms,distance_cm', () => '0,0'))
    expect(result.signals).toEqual([])
  })

  it('MPU6050이 32767에 붙어 있으면 I2C가 끊겼다고 알린다', () => {
    const hint = { expectedHeader: null, sensors: ['mpu6050'] }
    const result = checkReceivedLines(hint, rows('time_ms,ax,ay,az,g_norm', (i) => `${i * 10},32767,32767,32767,1.0`))
    expect(result.signals.map((signal) => signal.sign)).toEqual(['-1이나 32767 같은 값에 붙어 움직이지 않습니다'])
  })

  it('g로 나눠 찍는 MPU6050 스케치에서도 끊김을 알아본다', () => {
    const hint = { expectedHeader: null, sensors: ['mpu6050'] }
    const scaled = checkReceivedLines(hint, rows('time_ms,acceleration_x_g,gyro_z_dps', (i) => `${i * 10},-0.0001,-0.0076`))
    expect(scaled.signals.map((signal) => signal.sign)).toEqual(['-1이나 32767 같은 값에 붙어 움직이지 않습니다'])
    const resting = checkReceivedLines(hint, rows('time_ms,roll_deg,pitch_deg', (i) => `${i * 10},${0.4 + (i % 3) * 0.1},-1.2`))
    expect(resting.signals).toEqual([])
  })

  it('HC-SR04 시간 초과는 m 단위 스케치에서도 알아본다', () => {
    const hint = { expectedHeader: null, sensors: ['hc-sr04'] }
    const timedOut = checkReceivedLines(hint, rows('time_ms,distance_m', (i) => `${i * 100},4.00`))
    expect(timedOut.signals.map((signal) => signal.sign)).toEqual(['항상 400 언저리의 같은 값이 나옵니다'])
    const near = checkReceivedLines(hint, rows('time_ms,distance_m', (i) => `${i * 100},0.42`))
    expect(near.signals).toEqual([])
  })

  it('INA219 전류 0은 전압이 들어오고 40행이 쌓였을 때만 부하 문제로 본다', () => {
    const hint = { expectedHeader: null, sensors: ['ina219'] }
    const early = checkReceivedLines(hint, rows('time_ms,bus_V,current_mA', (i) => `${i * 100},5.02,0.00`, 20))
    expect(early.signals).toEqual([])
    const settled = checkReceivedLines(hint, rows('time_ms,bus_V,current_mA', (i) => `${i * 100},5.02,0.00`, 40))
    expect(settled.signals.map((signal) => signal.sign)).toEqual(['전류가 정확히 0.00에서 전혀 움직이지 않습니다'])
    const unpowered = checkReceivedLines(hint, rows('time_ms,bus_V,current_mA', (i) => `${i * 100},0.00,0.00`, 40))
    expect(unpowered.signals.map((signal) => signal.sign)).toEqual(['전압이 0에 가깝습니다'])
  })

  it('어두운 상자의 조도 0은 40행이 쌓이기 전에는 고장으로 보지 않는다', () => {
    const hint = { expectedHeader: null, sensors: ['tsl2591'] }
    expect(checkReceivedLines(hint, rows('time_ms,lux', (i) => `${i * 1000},0.00`, 39)).signals).toEqual([])
    expect(checkReceivedLines(hint, rows('time_ms,lux', (i) => `${i * 1000},0.00`, 40)).signals.map((s) => s.sign)).toEqual(['0에서 움직이지 않습니다'])
  })

  it('BME280 기압의 중앙값이 범위를 벗어나면 알리되, 한 줄만 튄 것은 넘어간다', () => {
    const hint = { expectedHeader: null, sensors: ['bme280'] }
    const broken = checkReceivedLines(hint, rows('time_ms,pressure_hpa,temperature_c', (i) => `${i},${5 + i},22`))
    expect(broken.signals.map((signal) => signal.sign)).toEqual(['기압이 300 hPa보다 낮거나 1100 hPa보다 높습니다'])
    const glitch = checkReceivedLines(hint, rows('time_ms,pressure_hpa,temperature_c', (i) => `${i},${i === 3 ? 5 : 1005},22`))
    expect(glitch.signals).toEqual([])
  })

  it('진단 줄이 섞여 있어도 값 행만으로 판단한다', () => {
    const lines = ['# booting', 'SENSOR_ERROR: none', ...rows('time_ms,distance_cm', (i) => `${i},0`)]
    const result = checkReceivedLines({ expectedHeader: null, sensors: ['hc-sr04'] }, lines)
    expect(result.signals.map((signal) => signal.sign)).toEqual(['0이 나옵니다'])
  })
})

describe('describeSilence', () => {
  it('값 행이 있으면 조용하고, 없으면 무엇이 왔는지 가른다', () => {
    expect(describeSilence(['time_ms,lux', '0,12.5'])).toBeNull()
    expect(describeSilence([])).toBe('nothing')
    expect(describeSilence(['', '   '])).toBe('nothing')
    expect(describeSilence(['time_ms,lux'])).toBe('headerOnly')
    expect(describeSilence(['# WOKWI_READY'])).toBe('nothing')
    expect(describeSilence(['# BME280_ERROR', 'time_ms,temperature_c'])).toBe('deviceError')
  })
})
