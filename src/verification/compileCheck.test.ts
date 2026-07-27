import { describe, it, expect } from 'vitest'
import { pendulumRecipe, multiTsl2591Recipe } from '@/data/canary'
import {
  compileSketch,
  stageSketch,
  severityFor,
  WARNING_THRESHOLD,
  ERROR_THRESHOLD,
} from './compileCheck'

// These tests shell out to the real arduino-cli and run a real avr-gcc build —
// nothing here is mocked, which is the whole point of the L2 gate. A cold
// build path costs a few seconds, so every compiling test gets a raised
// timeout.
const COMPILE_TIMEOUT = 120_000

/**
 * Global buffer sizes calibrated against a real Uno build (2048 B SRAM).
 * The array is initialised and read back in loop() so the compiler cannot
 * eliminate it. Measured: 1600 B => 87.3% SRAM, 1800 B => 97.1% SRAM.
 */
const heavySketch = (bytes: number) => `
char heavyBuffer[${bytes}] = { 1 };

void setup() {
  Serial.begin(9600);
}

void loop() {
  heavyBuffer[millis() % ${bytes}] = 7;
  Serial.println(heavyBuffer[0]);
  delay(100);
}
`

describe('severityFor', () => {
  it('is ok below the warning threshold', () => {
    expect(severityFor(79.9, 10)).toBe('ok')
    expect(severityFor(0, 0)).toBe('ok')
  })

  it('warns exactly at the 80% threshold', () => {
    expect(severityFor(WARNING_THRESHOLD, 10)).toBe('warning')
    expect(severityFor(94.9, 10)).toBe('warning')
  })

  it('errors exactly at the 95% threshold', () => {
    expect(severityFor(ERROR_THRESHOLD, 10)).toBe('error')
    expect(severityFor(99, 10)).toBe('error')
  })

  it('grades on whichever of SRAM or flash is higher', () => {
    expect(severityFor(10, 85)).toBe('warning')
    expect(severityFor(85, 10)).toBe('warning')
    expect(severityFor(10, 96)).toBe('error')
  })
})

describe('compileSketch — canary recipes', () => {
  it(
    'compiles the pendulum canary (Wire + MPU6050) with room to spare',
    async () => {
      const inoPath = stageSketch(pendulumRecipe.id, pendulumRecipe.sketch)
      const result = await compileSketch(inoPath)

      expect(result.compilePass).toBe(true)
      expect(result.severity).toBe('ok')
      expect(result.sramPercent).toBeGreaterThan(0)
      expect(result.flashPercent).toBeGreaterThan(0)
      expect(result.sramPercent).toBeLessThan(WARNING_THRESHOLD)
      expect(result.flashPercent).toBeLessThan(WARNING_THRESHOLD)
    },
    COMPILE_TIMEOUT,
  )

  it(
    'compiles the multi-TSL2591 canary (TCA9548A + Adafruit_TSL2591)',
    async () => {
      const inoPath = stageSketch(multiTsl2591Recipe.id, multiTsl2591Recipe.sketch)
      const result = await compileSketch(inoPath)

      expect(result.compilePass).toBe(true)
      expect(result.severity).toBe('ok')
      expect(result.sramPercent).toBeGreaterThan(0)
      expect(result.flashPercent).toBeGreaterThan(0)
    },
    COMPILE_TIMEOUT,
  )
})

describe('compileSketch — memory thresholds', () => {
  it(
    'flags a sketch that pushes SRAM past 80% as a warning',
    async () => {
      const inoPath = stageSketch('memory-warning-fixture', heavySketch(1600))
      const result = await compileSketch(inoPath)

      expect(result.compilePass).toBe(true)
      expect(result.sramPercent).toBeGreaterThanOrEqual(WARNING_THRESHOLD)
      expect(result.sramPercent).toBeLessThan(ERROR_THRESHOLD)
      expect(result.severity).toBe('warning')
    },
    COMPILE_TIMEOUT,
  )

  it(
    'flags a sketch that pushes SRAM past 95% as an error',
    async () => {
      const inoPath = stageSketch('memory-error-fixture', heavySketch(1800))
      const result = await compileSketch(inoPath)

      expect(result.compilePass).toBe(true)
      expect(result.sramPercent).toBeGreaterThanOrEqual(ERROR_THRESHOLD)
      expect(result.severity).toBe('error')
    },
    COMPILE_TIMEOUT,
  )
})

describe('compileSketch — build failures', () => {
  it(
    'reports a sketch that does not compile as an error',
    async () => {
      const inoPath = stageSketch(
        'broken-fixture',
        'void setup() { thisFunctionDoesNotExist(); }\nvoid loop() {}\n',
      )
      const result = await compileSketch(inoPath)

      expect(result.compilePass).toBe(false)
      expect(result.severity).toBe('error')
      expect(result.message).toContain('thisFunctionDoesNotExist')
    },
    COMPILE_TIMEOUT,
  )
})
