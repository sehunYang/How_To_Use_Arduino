import { describe, expect, it } from 'vitest'
import { RecipeSchema } from '@/schema'
import { sensors } from '@/data/inventory-seed/sensors'
import { actuators } from '@/data/inventory-seed/actuators'
import { resolveTunableAnchor } from '@/validation/manifest'
import { validateRecipe } from '@/validation/staticCheck'
import { sensorExampleRecipes } from './sensorExamples'

const inventory = { sensors, actuators }

describe('Phase 5 sensor examples S1-S10', () => {
  it('contains exactly the ten canonical sensor examples in order', () => {
    expect(sensorExampleRecipes.map((recipe) => recipe.id)).toEqual([
      'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10',
    ])
    expect(sensorExampleRecipes.every((recipe) => recipe.type === 'sensor-example')).toBe(true)
  })

  it('covers every owned sensor, with the mux example covering both required parts', () => {
    const covered = new Set(sensorExampleRecipes.flatMap((recipe) => recipe.sensors))
    expect(covered).toEqual(new Set(sensors.map((sensor) => sensor.id)))
    expect(sensorExampleRecipes[8].sensors).toEqual(['tca9548a', 'tsl2591'])
  })

  it('validates every complete Recipe object against the schema', () => {
    for (const recipe of sensorExampleRecipes) {
      const result = RecipeSchema.safeParse(recipe)
      expect(
        result.success,
        `${recipe.id}: ${JSON.stringify(result.success ? null : result.error.issues)}`,
      ).toBe(true)
    }
  })

  it('passes all publish-mode L1 checks', () => {
    for (const recipe of sensorExampleRecipes) {
      const errors = validateRecipe(recipe, inventory, 'publish').filter(
        (issue) => issue.severity === 'error',
      )
      expect(errors, `${recipe.id}: ${JSON.stringify(errors)}`).toHaveLength(0)
    }
  })

  it('has resolvable tunables and complete learning guidance', () => {
    for (const recipe of sensorExampleRecipes) {
      expect(recipe.tunables.length, recipe.id).toBeGreaterThan(0)
      for (const tunable of recipe.tunables) {
        expect(resolveTunableAnchor(recipe.sketch, tunable.anchor), recipe.id).not.toBeNull()
      }
      expect(recipe.body, recipe.id).toContain(':::toggle')
      expect(recipe.applicationGuide.trim().length, recipe.id).toBeGreaterThan(0)
      expect(recipe.troubleshooting.length, recipe.id).toBeGreaterThanOrEqual(2)
    }
  })

  it('states the simulation and calibration limits for the two stand-in/unsupported cases', () => {
    expect(sensorExampleRecipes[8].body).toContain('Wokwi 시뮬레이션 미지원')
    expect(sensorExampleRecipes[9].body).toContain('가변저항')
    expect(sensorExampleRecipes[9].body).toContain('자기장 단위가 아닙니다')
  })
})
