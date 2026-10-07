import { describe, expect, it } from 'vitest'
import { phase5Recipes } from '@/data/phase5'
import { phase5BehaviorSpecById, phase5BehaviorSpecs } from './behaviorSpecs'
import { checkSerialBehavior } from './serialBehavior'

const spec = phase5BehaviorSpecById.get('cooling-curve')!

const goodLog = [
  'time_s,temperature_c,excess_temperature_c',
  '0.8,22.000,0.000',
  '2.6,60.000,38.000',
  '4.4,45.000,23.000',
  '6.1,30.000,8.000',
  '7.9,22.500,0.500',
  '',
].join('\r\n')

describe('serial behaviour checker', () => {
  it('accepts a log that follows every stimulus', () => {
    expect(checkSerialBehavior(spec, goodLog)).toEqual({ ok: true, rows: 5, failures: [] })
  })

  it('tolerates a lagging row that still reports the previous stimulus', () => {
    const log = goodLog.replace('4.4,45.000,23.000', '4.4,60.000,38.000\n6.2,45.000,23.000')
      .replace('6.1,30.000', '8.0,30.000').replace('7.9,22.500', '9.8,22.500')
    expect(checkSerialBehavior(spec, log).ok).toBe(true)
  })

  it('rejects a missing header', () => {
    expect(checkSerialBehavior(spec, goodLog.replace('time_s,', 'time,')).failures)
      .toEqual(['header "time_s,temperature_c,excess_temperature_c" never printed'])
  })

  it('rejects nan rows from a disconnected sensor', () => {
    const result = checkSerialBehavior(spec, goodLog.replace('4.4,45.000,23.000', '4.4,nan,nan'))
    expect(result.ok).toBe(false)
    expect(result.failures).toContain('row 3 "4.4,nan,nan": temperature_c is not a number')
  })

  it('rejects the DS18B20 85 °C power-on value', () => {
    const result = checkSerialBehavior(spec, goodLog.replace('4.4,45.000,23.000', '4.4,85.000,63.000'))
    expect(result.failures.some((failure) => failure.includes('matches no applied stimulus'))).toBe(true)
  })

  it('rejects a wrong excess-temperature calculation', () => {
    const result = checkSerialBehavior(spec, goodLog.replace('2.6,60.000,38.000', '2.6,60.000,60.000'))
    expect(result.failures).toContain('row 2 "2.6,60.000,60.000": excess_temperature_c=60, expected 38.000')
  })

  it('rejects readings that go back to an earlier stimulus', () => {
    const result = checkSerialBehavior(spec, goodLog.replace('6.1,30.000,8.000', '6.1,60.000,38.000'))
    expect(result.ok).toBe(false)
  })

  it('rejects a sampling interval far from the recipe loop', () => {
    const result = checkSerialBehavior(spec, goodLog.replace('4.4,', '9.4,'))
    expect(result.failures.some((failure) => failure.includes('time_s step'))).toBe(true)
  })

  it('rejects a log that never reached the last stimulus', () => {
    const result = checkSerialBehavior(spec, goodLog.replace('7.9,22.500,0.500\r\n', ''))
    expect(result.failures).toContain('temperature_c never reported 22.5')
  })
})

describe('behaviour specs', () => {
  it('match the recipe sketches they claim to test', () => {
    for (const behavior of phase5BehaviorSpecs) {
      const recipe = phase5Recipes.find((candidate) => candidate.id === behavior.recipeId)
      expect(recipe, behavior.recipeId).toBeDefined()
      expect(recipe!.sketch, behavior.recipeId).toContain(`Serial.println("${behavior.header}");`)
    }
  })

  it('keep the cooling-curve oracle on the recipe default ambient temperature', () => {
    const recipe = phase5Recipes.find((candidate) => candidate.id === 'cooling-curve')!
    expect(recipe.sketch).toContain('float ambientTemperatureC = 22.0;')
  })
})
