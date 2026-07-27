import { describe, it, expect } from 'vitest'
import {
  RecipeSchema,
  WiringStepSchema,
  TunableParamSchema,
  SensorSchema,
  AddressingSchema,
  SensorRationaleSchema,
  AnonEventSchema,
  SimStatusSchema,
  StatsSchema,
} from './index'

const validWiringStep = {
  from: 'MPU6050.VCC',
  to: 'UNO.5V',
  color: 'red',
  focus: { x: 10, y: 10, w: 40, h: 20 },
  text: '빨간 선을 5V에 연결하세요',
}

const validRecipe = {
  id: 'pendulum',
  type: 'project' as const,
  title: '단진자의 주기 측정하기',
  subject: '물리' as const,
  difficulty: '중급' as const,
  minutes: 60,
  board: 'uno-r3' as const,
  sensors: ['mpu6050'],
  actuators: [],
  coreKeywords: ['진자', '주기', '에너지'],
  imageUrl: 'wiring/pendulum.png',
  imageWidth: 800,
  imageHeight: 600,
  wiring: [validWiringStep],
  sketch: '// @pin SDA=A4\n// @baud 9600\nvoid setup() {}\nvoid loop() {}',
  baudRate: 9600,
  tunables: [{ anchor: 'threshold', name: '임계값', hint: '숫자를 높이면 둔감해집니다' }],
  body: '이 탐구는 단진자의 주기를 측정합니다.',
  applicationGuide: '진폭을 바꿔서 실험해보세요.',
  troubleshooting: [{ symptom: '값이 안 나옴', cause: 'SDA/SCL 배선 오류', fix: 'A4/A5 연결을 확인하세요' }],
  status: 'draft' as const,
  reviewedOnDevice: null,
  commentReviewed: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('RecipeSchema', () => {
  it('accepts a fully-populated valid recipe', () => {
    expect(RecipeSchema.safeParse(validRecipe).success).toBe(true)
  })

  it('rejects a recipe missing the required sketch field', () => {
    const { sketch: _sketch, ...withoutSketch } = validRecipe
    expect(RecipeSchema.safeParse(withoutSketch).success).toBe(false)
  })

  it('rejects a recipe with a non-string title', () => {
    expect(RecipeSchema.safeParse({ ...validRecipe, title: 42 }).success).toBe(false)
  })

  it('rejects an unknown subject value', () => {
    expect(RecipeSchema.safeParse({ ...validRecipe, subject: '수학' }).success).toBe(false)
  })

  it('accepts a review flag as {at, verifyHash} and rejects a bare boolean', () => {
    expect(
      RecipeSchema.safeParse({
        ...validRecipe,
        reviewedOnDevice: { at: '2026-01-02T00:00:00.000Z', verifyHash: 'abc123' },
      }).success,
    ).toBe(true)
    expect(RecipeSchema.safeParse({ ...validRecipe, reviewedOnDevice: true }).success).toBe(false)
  })
})

describe('WiringStepSchema', () => {
  it('accepts a valid step', () => {
    expect(WiringStepSchema.safeParse(validWiringStep).success).toBe(true)
  })

  it('rejects a step missing focus', () => {
    const { focus: _focus, ...withoutFocus } = validWiringStep
    expect(WiringStepSchema.safeParse(withoutFocus).success).toBe(false)
  })

  it('rejects a step with a negative focus width', () => {
    expect(
      WiringStepSchema.safeParse({
        ...validWiringStep,
        focus: { x: 0, y: 0, w: -5, h: 10 },
      }).success,
    ).toBe(false)
  })
})

describe('TunableParamSchema (anchor, not line number)', () => {
  it('accepts a marker-string anchor', () => {
    expect(
      TunableParamSchema.safeParse({ anchor: 'threshold', name: '임계값', hint: '높이세요' })
        .success,
    ).toBe(true)
  })

  it('rejects a numeric line-number style value for anchor', () => {
    expect(
      TunableParamSchema.safeParse({ anchor: 12, name: '임계값', hint: '높이세요' }).success,
    ).toBe(false)
  })
})

describe('Sensor.addressing discriminated union — all 4 real modes', () => {
  it('accepts fixed mode (TSL2591-style: single fixed address)', () => {
    const r = AddressingSchema.safeParse({ mode: 'fixed', addresses: ['0x29'], maxOnBus: 1 })
    expect(r.success).toBe(true)
  })

  it('accepts strapped mode (INA219-style: address-selectable via strap pins)', () => {
    const r = AddressingSchema.safeParse({
      mode: 'strapped',
      addresses: ['0x40', '0x41', '0x44', '0x45'],
      strapPins: ['A0', 'A1'],
      maxOnBus: 4,
    })
    expect(r.success).toBe(true)
  })

  it('accepts onewire mode (DS18B20-style: unlimited unique ROM IDs)', () => {
    const r = AddressingSchema.safeParse({ mode: 'onewire', maxOnBus: 255 })
    expect(r.success).toBe(true)
  })

  it('accepts none mode (digital/analog sensors with no bus address)', () => {
    const r = AddressingSchema.safeParse({ mode: 'none' })
    expect(r.success).toBe(true)
  })

  it('rejects strapped mode missing strapPins', () => {
    const r = AddressingSchema.safeParse({ mode: 'strapped', addresses: ['0x40'], maxOnBus: 4 })
    expect(r.success).toBe(false)
  })

  it('rejects an unknown mode literal', () => {
    const r = AddressingSchema.safeParse({ mode: 'dynamic', maxOnBus: 1 })
    expect(r.success).toBe(false)
  })
})

describe('SensorSchema', () => {
  const validSensor = {
    id: 'mpu6050',
    name: 'MPU6050',
    interface: 'i2c' as const,
    addressing: { mode: 'strapped' as const, addresses: ['0x68', '0x69'], strapPins: ['AD0'], maxOnBus: 2 },
    pins: [{ name: 'SDA', kind: 'i2c' as const }, { name: 'SCL', kind: 'i2c' as const }],
    currentDrawMa: 4,
    wokwi: { part: 'wokwi-mpu6050', pinMap: { SDA: 'SDA', SCL: 'SCL' }, simSupported: true },
  }

  it('accepts a valid sensor', () => {
    expect(SensorSchema.safeParse(validSensor).success).toBe(true)
  })

  it('rejects a sensor missing wokwi descriptor', () => {
    const { wokwi: _wokwi, ...withoutWokwi } = validSensor
    expect(SensorSchema.safeParse(withoutWokwi).success).toBe(false)
  })

  it('rejects a negative currentDrawMa', () => {
    expect(SensorSchema.safeParse({ ...validSensor, currentDrawMa: -1 }).success).toBe(false)
  })
})

describe('SensorRationaleSchema', () => {
  it('accepts a valid rationale', () => {
    expect(
      SensorRationaleSchema.safeParse({
        sensorId: 'mpu6050',
        subject: '물리',
        whyText: '가속도와 각속도를 동시에 측정할 수 있어서',
      }).success,
    ).toBe(true)
  })

  it('rejects an empty whyText', () => {
    expect(
      SensorRationaleSchema.safeParse({ sensorId: 'mpu6050', subject: '물리', whyText: '' })
        .success,
    ).toBe(false)
  })

  it('rejects a missing sensorId', () => {
    expect(
      SensorRationaleSchema.safeParse({ subject: '물리', whyText: '이유' }).success,
    ).toBe(false)
  })
})

describe('AnonEventSchema (G2: no identifying fields exist to strip)', () => {
  it('accepts a valid anonymous event', () => {
    expect(
      AnonEventSchema.safeParse({
        anonId: 'a7f3-random-uuid',
        recipeId: 'pendulum',
        step: 3,
        event: 'step_check',
        at: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(true)
  })

  it('rejects an anonId over the 64-char cap', () => {
    expect(
      AnonEventSchema.safeParse({
        anonId: 'a'.repeat(65),
        recipeId: 'pendulum',
        event: 'start',
        at: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(false)
  })

  it('rejects an unknown event type', () => {
    expect(
      AnonEventSchema.safeParse({
        anonId: 'a7f3',
        recipeId: 'pendulum',
        event: 'name_typed', // not in the allowed enum — schema has no field for identifying text
        at: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(false)
  })
})

describe('SimStatusSchema', () => {
  it('accepts a valid CI-written status', () => {
    expect(
      SimStatusSchema.safeParse({
        verifyHash: 'sha256:abc',
        compilePass: true,
        simPass: true,
        logicPass: true,
        staticIssues: [],
        verifiedAt: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(true)
  })

  it('allows simPass to be null (sensor not simulation-supported)', () => {
    expect(
      SimStatusSchema.safeParse({
        verifyHash: 'sha256:abc',
        compilePass: true,
        simPass: null,
        logicPass: true,
        staticIssues: [],
        verifiedAt: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(true)
  })

  it('rejects a non-boolean compilePass', () => {
    expect(
      SimStatusSchema.safeParse({
        verifyHash: 'sha256:abc',
        compilePass: 'yes',
        simPass: null,
        logicPass: true,
        staticIssues: [],
        verifiedAt: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(false)
  })
})

describe('StatsSchema', () => {
  it('accepts a valid rollup with defaults applied', () => {
    const r = StatsSchema.safeParse({})
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.started).toBe(0)
      expect(r.data.processedThrough).toBeNull()
    }
  })

  it('rejects a negative completed count', () => {
    expect(StatsSchema.safeParse({ completed: -1 }).success).toBe(false)
  })
})
