import { describe, it, expect } from 'vitest'
import type { Recipe } from '@/schema'
import { sensors } from '@/data/inventory-seed/sensors'
import { actuators } from '@/data/inventory-seed/actuators'
import { validateRecipe } from './staticCheck'

const inventory = { sensors, actuators }

/** A minimal, fully clean recipe — zero violations of any of the 11 checks. */
const cleanRecipe: Recipe = {
  id: 'test-recipe',
  type: 'project',
  title: '테스트 레시피',
  subject: '물리',
  difficulty: '중급',
  minutes: 30,
  board: 'uno-r3',
  sensors: ['mpu6050'],
  actuators: ['led'],
  coreKeywords: ['테스트'],
  imageUrl: 'wiring/test.png',
  imageWidth: 800,
  imageHeight: 600,
  wiring: [
    { from: 'MPU6050.SDA', to: 'UNO.A4', color: 'blue', focus: { x: 0, y: 0, w: 10, h: 10 }, text: 'SDA를 A4에 연결하세요' },
    { from: 'MPU6050.SCL', to: 'UNO.A5', color: 'yellow', focus: { x: 20, y: 0, w: 10, h: 10 }, text: 'SCL을 A5에 연결하세요' },
  ],
  sketch: '// @pin SDA=A4\n// @pin SCL=A5\n// @baud 9600\nvoid setup() {}\nvoid loop() {}',
  baudRate: 9600,
  // Deliberately empty: several other fixtures below override `sketch`
  // without a `@tunable` marker, and since they spread `...cleanRecipe`,
  // a non-empty `tunables` here would make check #9 fire unexpectedly on
  // every one of them. Check #9 gets its own dedicated fixture instead.
  tunables: [],
  body: '테스트 본문입니다.',
  applicationGuide: '응용 가이드입니다.',
  troubleshooting: [{ symptom: '증상', cause: '원인', fix: '해결법' }],
  status: 'published',
  reviewedOnDevice: null,
  commentReviewed: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
}

// One targeted fixture per check (1-8), each mutated from a clean baseline
// so only the check under test fires. Each is an independently-built
// recipe rather than a spread-mutation of `cleanRecipe`, so unrelated
// fields (wiring/manifest/sensors/actuators) can be kept mutually
// consistent for that specific violation.

const pinDuplicateRecipe: Recipe = {
  ...cleanRecipe,
  id: 'pin-duplicate-fixture',
  sensors: [],
  actuators: ['led', 'buzzer'],
  wiring: [
    { from: 'LED.ANODE', to: 'UNO.D9', color: 'red', focus: { x: 0, y: 0, w: 10, h: 10 }, text: 'LED 양극을 D9에 연결하세요' },
    { from: 'BUZZER.SIGNAL', to: 'UNO.D9', color: 'green', focus: { x: 20, y: 0, w: 10, h: 10 }, text: '부저 신호를 D9에 연결하세요' },
  ],
  sketch: '// @pin OUT=D9\n// @baud 9600\nvoid setup() {}\nvoid loop() {}',
}

const i2cAddressConflictRecipe: Recipe = {
  ...cleanRecipe,
  id: 'i2c-conflict-fixture',
  sensors: ['tsl2591'],
  actuators: [],
  wiring: [
    { from: 'TSL2591_1.SDA', to: 'UNO.A4', color: 'blue', focus: { x: 0, y: 0, w: 10, h: 10 }, text: '센서1 SDA를 A4에 연결하세요' },
    { from: 'TSL2591_2.SDA', to: 'UNO.A4', color: 'blue', focus: { x: 20, y: 0, w: 10, h: 10 }, text: '센서2 SDA를 A4에 연결하세요' },
  ],
  sketch: '// @pin SDA=A4\n// @baud 9600\nvoid setup() {}\nvoid loop() {}',
}

const nonexistentPinRecipe: Recipe = {
  ...cleanRecipe,
  id: 'nonexistent-pin-fixture',
  sensors: [],
  actuators: ['led'],
  wiring: [
    { from: 'LED.ANODE', to: 'UNO.D99', color: 'red', focus: { x: 0, y: 0, w: 10, h: 10 }, text: 'LED를 D99에 연결하세요' },
  ],
  sketch: '// @pin OUT=D99\n// @baud 9600\nvoid setup() {}\nvoid loop() {}',
}

const unownedComponentRecipe: Recipe = {
  ...cleanRecipe,
  id: 'unowned-component-fixture',
  sensors: ['mpu6050', 'unknown-sensor-xyz'],
  actuators: [],
}

const wiringEmptyRecipe: Recipe = {
  ...cleanRecipe,
  id: 'wiring-empty-fixture',
  sensors: [],
  actuators: [],
  wiring: [],
  sketch: '// @baud 9600\nvoid setup() {}\nvoid loop() {}',
}

const duplicateFocusRectRecipe: Recipe = {
  ...cleanRecipe,
  id: 'duplicate-focus-fixture',
  sensors: [],
  actuators: ['led', 'buzzer'],
  wiring: [
    { from: 'LED.ANODE', to: 'UNO.D9', color: 'red', focus: { x: 5, y: 5, w: 15, h: 15 }, text: 'LED를 D9에 연결하세요' },
    { from: 'BUZZER.SIGNAL', to: 'UNO.D10', color: 'green', focus: { x: 5, y: 5, w: 15, h: 15 }, text: '부저를 D10에 연결하세요' },
  ],
  sketch: '// @pin LEDPIN=D9\n// @pin BUZZPIN=D10\n// @baud 9600\nvoid setup() {}\nvoid loop() {}',
}

const manifestWiringMismatchRecipe: Recipe = {
  ...cleanRecipe,
  id: 'manifest-mismatch-fixture',
  sensors: [],
  actuators: ['led'],
  wiring: [
    { from: 'LED.ANODE', to: 'UNO.D9', color: 'red', focus: { x: 0, y: 0, w: 10, h: 10 }, text: 'LED를 D9에 연결하세요' },
  ],
  sketch: '// @pin OUT=D11\n// @baud 9600\nvoid setup() {}\nvoid loop() {}',
}

const externalPowerMissingRecipe: Recipe = {
  ...cleanRecipe,
  id: 'external-power-fixture',
  sensors: [],
  actuators: ['dc-motor-driver'],
  wiring: [
    { from: 'MOTOR.IN1', to: 'UNO.D5', color: 'red', focus: { x: 0, y: 0, w: 10, h: 10 }, text: 'IN1을 D5에 연결하세요' },
  ],
  sketch: '// @pin M1=D5\n// @baud 9600\nvoid setup() {}\nvoid loop() {}',
}

const tunableAnchorUnresolvedRecipe: Recipe = {
  ...cleanRecipe,
  id: 'tunable-anchor-fixture',
  tunables: [{ anchor: 'doesNotExist', name: '없는 튜너블', hint: '이 앵커는 스케치에 없습니다' }],
}

const baudMismatchRecipe: Recipe = {
  ...cleanRecipe,
  id: 'baud-mismatch-fixture',
  baudRate: 115200,
  // sketch's @baud (9600) intentionally left at cleanRecipe's value, disagreeing with baudRate above
}

const missingGuidanceRecipe: Recipe = {
  ...cleanRecipe,
  id: 'missing-guidance-fixture',
  applicationGuide: '',
  troubleshooting: [],
}

describe('validateRecipe — clean fixture', () => {
  it('returns an empty array in publish mode', () => {
    expect(validateRecipe(cleanRecipe, inventory, 'publish')).toEqual([])
  })

  it('returns an empty array in draft mode', () => {
    expect(validateRecipe(cleanRecipe, inventory, 'draft')).toEqual([])
  })
})

describe('validateRecipe — check #1 pin-duplicate', () => {
  it('flags as error in publish mode', () => {
    const issues = validateRecipe(pinDuplicateRecipe, inventory, 'publish')
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('pin-duplicate')
    expect(issues[0].severity).toBe('error')
  })

  it('flags as warning in draft mode and never throws', () => {
    const issues = validateRecipe(pinDuplicateRecipe, inventory, 'draft')
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('pin-duplicate')
    expect(issues[0].severity).toBe('warning')
  })
})

describe('validateRecipe — check #2 i2c-address-conflict', () => {
  it('flags as error in publish mode', () => {
    const issues = validateRecipe(i2cAddressConflictRecipe, inventory, 'publish')
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('i2c-address-conflict')
    expect(issues[0].severity).toBe('error')
  })

  it('flags as warning in draft mode', () => {
    const issues = validateRecipe(i2cAddressConflictRecipe, inventory, 'draft')
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('i2c-address-conflict')
    expect(issues[0].severity).toBe('warning')
  })
})

describe('validateRecipe — check #3 nonexistent-pin', () => {
  it('flags as error in publish mode', () => {
    const issues = validateRecipe(nonexistentPinRecipe, inventory, 'publish')
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('nonexistent-pin')
    expect(issues[0].severity).toBe('error')
  })

  it('flags as warning in draft mode', () => {
    const issues = validateRecipe(nonexistentPinRecipe, inventory, 'draft')
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('nonexistent-pin')
    expect(issues[0].severity).toBe('warning')
  })
})

describe('validateRecipe — check #4 unowned-component', () => {
  it('flags as error in publish mode', () => {
    const issues = validateRecipe(unownedComponentRecipe, inventory, 'publish')
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('unowned-component')
    expect(issues[0].severity).toBe('error')
  })

  it('flags as warning in draft mode', () => {
    const issues = validateRecipe(unownedComponentRecipe, inventory, 'draft')
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('unowned-component')
    expect(issues[0].severity).toBe('warning')
  })
})

describe('validateRecipe — check #5 wiring-empty (publish-mode only)', () => {
  it('flags as error in publish mode', () => {
    const issues = validateRecipe(wiringEmptyRecipe, inventory, 'publish')
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('wiring-empty')
    expect(issues[0].severity).toBe('error')
  })

  it('is silent in draft mode — a draft is allowed an empty/incomplete wiring[] by design', () => {
    const issues = validateRecipe(wiringEmptyRecipe, inventory, 'draft')
    expect(issues).toEqual([])
  })
})

describe('validateRecipe — check #6 duplicate-focus-rect', () => {
  it('flags as error in publish mode', () => {
    const issues = validateRecipe(duplicateFocusRectRecipe, inventory, 'publish')
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('duplicate-focus-rect')
    expect(issues[0].severity).toBe('error')
  })

  it('flags as warning in draft mode', () => {
    const issues = validateRecipe(duplicateFocusRectRecipe, inventory, 'draft')
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('duplicate-focus-rect')
    expect(issues[0].severity).toBe('warning')
  })
})

describe('validateRecipe — check #6 focus-out-of-bounds (F4)', () => {
  const outOfBoundsRecipe: Recipe = {
    ...cleanRecipe,
    id: 'focus-out-of-bounds-fixture',
    imageWidth: 200,
    imageHeight: 150,
    sensors: [],
    actuators: ['led'],
    wiring: [
      // w+x = 220 > imageWidth 200 -- spills past the right edge
      { from: 'LED.ANODE', to: 'UNO.D9', color: 'red', focus: { x: 180, y: 10, w: 40, h: 20 }, text: 'LED를 D9에 연결하세요' },
    ],
    sketch: '// @pin OUT=D9\n// @baud 9600\nvoid setup() {}\nvoid loop() {}',
  }

  it('flags as error in publish mode', () => {
    const issues = validateRecipe(outOfBoundsRecipe, inventory, 'publish')
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('focus-out-of-bounds')
    expect(issues[0].severity).toBe('error')
  })

  it('flags as warning in draft mode', () => {
    const issues = validateRecipe(outOfBoundsRecipe, inventory, 'draft')
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('focus-out-of-bounds')
    expect(issues[0].severity).toBe('warning')
  })

  it('a negative x/y is also out of bounds', () => {
    const negativeOrigin: Recipe = {
      ...outOfBoundsRecipe,
      id: 'focus-negative-origin-fixture',
      wiring: [
        { from: 'LED.ANODE', to: 'UNO.D9', color: 'red', focus: { x: -5, y: 10, w: 20, h: 20 }, text: 'LED를 D9에 연결하세요' },
      ],
    }
    const issues = validateRecipe(negativeOrigin, inventory, 'publish')
    expect(issues.some((i) => i.code === 'focus-out-of-bounds')).toBe(true)
  })

  it('does not flag a focus rect that exactly touches the image edge', () => {
    const touchesEdge: Recipe = {
      ...outOfBoundsRecipe,
      id: 'focus-touches-edge-fixture',
      wiring: [
        { from: 'LED.ANODE', to: 'UNO.D9', color: 'red', focus: { x: 160, y: 130, w: 40, h: 20 }, text: 'LED를 D9에 연결하세요' },
      ],
    }
    const issues = validateRecipe(touchesEdge, inventory, 'publish')
    expect(issues.some((i) => i.code === 'focus-out-of-bounds')).toBe(false)
  })
})

describe('validateRecipe — check #7 manifest-wiring-mismatch', () => {
  it('flags as error in publish mode (both directions)', () => {
    const issues = validateRecipe(manifestWiringMismatchRecipe, inventory, 'publish')
    expect(issues.length).toBeGreaterThan(0)
    expect(issues.every((i) => i.code === 'manifest-wiring-mismatch')).toBe(true)
    expect(issues.every((i) => i.severity === 'error')).toBe(true)
  })

  it('flags as warning in draft mode', () => {
    const issues = validateRecipe(manifestWiringMismatchRecipe, inventory, 'draft')
    expect(issues.length).toBeGreaterThan(0)
    expect(issues.every((i) => i.code === 'manifest-wiring-mismatch')).toBe(true)
    expect(issues.every((i) => i.severity === 'warning')).toBe(true)
  })
})

describe('validateRecipe — check #8 external-power-missing', () => {
  it('flags as error in publish mode', () => {
    const issues = validateRecipe(externalPowerMissingRecipe, inventory, 'publish')
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('external-power-missing')
    expect(issues[0].severity).toBe('error')
  })

  it('flags as warning in draft mode', () => {
    const issues = validateRecipe(externalPowerMissingRecipe, inventory, 'draft')
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('external-power-missing')
    expect(issues[0].severity).toBe('warning')
  })
})

describe('validateRecipe — check #9 tunable-anchor-unresolved', () => {
  it('flags as error in publish mode', () => {
    const issues = validateRecipe(tunableAnchorUnresolvedRecipe, inventory, 'publish')
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('tunable-anchor-unresolved')
    expect(issues[0].severity).toBe('error')
  })

  it('flags as warning in draft mode', () => {
    const issues = validateRecipe(tunableAnchorUnresolvedRecipe, inventory, 'draft')
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('tunable-anchor-unresolved')
    expect(issues[0].severity).toBe('warning')
  })
})

describe('validateRecipe — check #10 baud-mismatch', () => {
  it('flags as error in publish mode', () => {
    const issues = validateRecipe(baudMismatchRecipe, inventory, 'publish')
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('baud-mismatch')
    expect(issues[0].severity).toBe('error')
  })

  it('flags as warning in draft mode', () => {
    const issues = validateRecipe(baudMismatchRecipe, inventory, 'draft')
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('baud-mismatch')
    expect(issues[0].severity).toBe('warning')
  })
})

describe('validateRecipe — check #11 missing-guidance (publish-mode only)', () => {
  it('flags as error in publish mode (both applicationGuide and troubleshooting)', () => {
    const issues = validateRecipe(missingGuidanceRecipe, inventory, 'publish')
    expect(issues).toHaveLength(2)
    expect(issues.every((i) => i.code === 'missing-guidance')).toBe(true)
    expect(issues.every((i) => i.severity === 'error')).toBe(true)
  })

  it('is silent in draft mode — a draft is allowed to lack guidance text by design', () => {
    const issues = validateRecipe(missingGuidanceRecipe, inventory, 'draft')
    expect(issues).toEqual([])
  })
})

// --- Regression tests for the post-architect-review fixes (F1, F2, F3, F6) ---
// Added because the existing per-check fixtures above happened not to exercise
// any of these four bugs, so a passing suite gave false confidence.

describe('F1 — a @pin manifest entry naming a power rail is always flagged', () => {
  const powerPinManifestRecipe: Recipe = {
    ...cleanRecipe,
    id: 'f1-power-pin-manifest-fixture',
    sensors: [],
    actuators: ['led'],
    wiring: [
      { from: 'LED.ANODE', to: 'UNO.D9', color: 'red', focus: { x: 0, y: 0, w: 10, h: 10 }, text: 'LED를 D9에 연결하세요' },
    ],
    // @pin PWR=5V is the bug: manifest pins must name functionally-significant
    // code pins only, never a power rail — this used to pass silently.
    sketch: '// @pin OUT=D9\n// @pin PWR=5V\n// @baud 9600\nvoid setup() {}\nvoid loop() {}',
  }

  it('flags manifest-wiring-mismatch even though the wiring[] does connect to 5V', () => {
    const issues = validateRecipe(powerPinManifestRecipe, inventory, 'publish')
    expect(issues.some((i) => i.code === 'manifest-wiring-mismatch')).toBe(true)
  })
})

describe('F2 — I2C conflict is generalized to addressing.maxOnBus, not just mode==="fixed"', () => {
  it('flags a strapped sensor (INA219, maxOnBus 4) wired a 5th time with no mux present', () => {
    const overWiredStrapped: Recipe = {
      ...cleanRecipe,
      id: 'f2-strapped-overflow-fixture',
      sensors: ['ina219'],
      actuators: [],
      wiring: [1, 2, 3, 4, 5].map((n) => ({
        from: `INA219_${n}.SDA`,
        to: 'UNO.A4',
        color: 'blue',
        focus: { x: n * 10, y: 0, w: 5, h: 5 },
        text: `센서${n}의 SDA를 A4에 연결하세요`,
      })),
      sketch: '// @pin SDA=A4\n// @baud 9600\nvoid setup() {}\nvoid loop() {}',
    }
    const issues = validateRecipe(overWiredStrapped, inventory, 'publish')
    expect(issues.some((i) => i.code === 'i2c-address-conflict')).toBe(true)
  })

  it('does NOT flag the same strapped sensor wired only up to its maxOnBus (4)', () => {
    const withinBudget: Recipe = {
      ...cleanRecipe,
      id: 'f2-strapped-within-budget-fixture',
      sensors: ['ina219'],
      actuators: [],
      wiring: [1, 2, 3, 4].map((n) => ({
        from: `INA219_${n}.SDA`,
        to: 'UNO.A4',
        color: 'blue',
        focus: { x: n * 10, y: 0, w: 5, h: 5 },
        text: `센서${n}의 SDA를 A4에 연결하세요`,
      })),
      sketch: '// @pin SDA=A4\n// @baud 9600\nvoid setup() {}\nvoid loop() {}',
    }
    const issues = validateRecipe(withinBudget, inventory, 'publish')
    expect(issues.some((i) => i.code === 'i2c-address-conflict')).toBe(false)
  })
})

describe('F3 — the multiplexer escape hatch is data-driven (Sensor.muxChannels), not a hardcoded id', () => {
  it('a non-"tca9548a" sensor with muxChannels > 0 also resolves an address conflict', () => {
    const genericMux = {
      id: 'generic-mux',
      name: 'Generic Mux',
      interface: 'i2c' as const,
      addressing: { mode: 'none' as const },
      pins: [],
      currentDrawMa: 1,
      wokwi: { part: 'custom-generic-mux', pinMap: {}, simSupported: false },
      muxChannels: 4,
    }
    const fixedThing = {
      id: 'fixed-thing',
      name: 'Fixed Thing',
      interface: 'i2c' as const,
      addressing: { mode: 'fixed' as const, addresses: ['0x11'], maxOnBus: 1 },
      pins: [],
      currentDrawMa: 1,
      wokwi: { part: 'custom-fixed-thing', pinMap: {}, simSupported: false },
      muxChannels: 0,
    }
    const customInventory = { sensors: [genericMux, fixedThing], actuators: [] }

    const recipe: Recipe = {
      ...cleanRecipe,
      id: 'f3-generic-mux-fixture',
      sensors: ['fixed-thing', 'generic-mux'],
      actuators: [],
      wiring: [1, 2].map((n) => ({
        from: `FIXED-THING_${n}.SDA`,
        to: 'UNO.A4',
        color: 'blue',
        focus: { x: n * 10, y: 0, w: 5, h: 5 },
        text: `센서${n}의 SDA를 A4에 연결하세요`,
      })),
      sketch: '// @pin SDA=A4\n// @baud 9600\nvoid setup() {}\nvoid loop() {}',
    }

    const issues = validateRecipe(recipe, customInventory, 'publish')
    expect(issues.some((i) => i.code === 'i2c-address-conflict')).toBe(false)
  })
})

describe('F6 — external-power-required counts sensor draw, not just actuator draw', () => {
  it('fires when sensors alone (no actuators) cross 400mA total', () => {
    const heavySensor = {
      id: 'heavy-sensor',
      name: 'Heavy Sensor',
      interface: 'digital' as const,
      addressing: { mode: 'none' as const },
      pins: [{ name: 'OUT', kind: 'digital' as const }],
      currentDrawMa: 450,
      wokwi: { part: 'custom-heavy-sensor', pinMap: {}, simSupported: false },
      muxChannels: 0,
    }
    const customInventory = { sensors: [heavySensor], actuators: [] }
    const recipe: Recipe = {
      ...cleanRecipe,
      id: 'f6-sensor-only-power-fixture',
      sensors: ['heavy-sensor'],
      actuators: [],
      wiring: [
        { from: 'HEAVY-SENSOR.OUT', to: 'UNO.D5', color: 'red', focus: { x: 0, y: 0, w: 10, h: 10 }, text: 'OUT을 D5에 연결하세요' },
      ],
      sketch: '// @pin OUT=D5\n// @baud 9600\nvoid setup() {}\nvoid loop() {}',
    }
    const issues = validateRecipe(recipe, customInventory, 'publish')
    expect(issues.some((i) => i.code === 'external-power-missing')).toBe(true)
  })
})
