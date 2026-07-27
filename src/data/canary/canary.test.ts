import { describe, it, expect } from 'vitest'
import { RecipeSchema, SensorRationaleSchema, SimStatusSchema } from '@/schema'
import { resolveTunableAnchor } from '@/validation/manifest'
import { validateRecipe } from '@/validation/staticCheck'
import { computeVerifyHash } from '@/lib/verifyHash'
import { sensors } from '@/data/inventory-seed/sensors'
import { actuators } from '@/data/inventory-seed/actuators'
import { pendulumRecipe, multiTsl2591Recipe, canaryRationales, canarySimStatus } from './index'

const inventory = { sensors, actuators }

const recipes = [pendulumRecipe, multiTsl2591Recipe]

describe('canary recipe fixtures', () => {
  it('both validate against RecipeSchema with zero errors', () => {
    for (const recipe of recipes) {
      const result = RecipeSchema.safeParse(recipe)
      expect(result.success, `${recipe.id}: ${JSON.stringify(result.success ? null : result.error.issues)}`).toBe(true)
    }
  })

  it('one is draft and one is published (both branches exercised downstream)', () => {
    const statuses = recipes.map((r) => r.status).sort()
    expect(statuses).toEqual(['draft', 'published'])
  })

  it('each has a non-empty wiring[] with focus regions', () => {
    for (const recipe of recipes) {
      expect(recipe.wiring.length, recipe.id).toBeGreaterThan(0)
      for (const step of recipe.wiring) {
        expect(step.focus.w, `${recipe.id} step`).toBeGreaterThan(0)
        expect(step.focus.h, `${recipe.id} step`).toBeGreaterThan(0)
      }
    }
  })

  it('every tunable anchor resolves to exactly one line in its own sketch', () => {
    for (const recipe of recipes) {
      expect(recipe.tunables.length, recipe.id).toBeGreaterThan(0)
      for (const tunable of recipe.tunables) {
        const line = resolveTunableAnchor(recipe.sketch, tunable.anchor)
        expect(line, `${recipe.id}: anchor "${tunable.anchor}"`).not.toBeNull()
      }
    }
  })

  it('each has non-empty applicationGuide and troubleshooting[]', () => {
    for (const recipe of recipes) {
      expect(recipe.applicationGuide.length, recipe.id).toBeGreaterThan(0)
      expect(recipe.troubleshooting.length, recipe.id).toBeGreaterThan(0)
    }
  })

  it('the published fixture passes L1 in publish mode with zero errors', () => {
    const issues = validateRecipe(pendulumRecipe, inventory, 'publish')
    const errors = issues.filter((i) => i.severity === 'error')
    expect(errors, JSON.stringify(errors)).toHaveLength(0)
  })

  it('the draft fixture passes L1 in draft mode with zero errors (warnings are non-blocking)', () => {
    const issues = validateRecipe(multiTsl2591Recipe, inventory, 'draft')
    const errors = issues.filter((i) => i.severity === 'error')
    expect(errors, JSON.stringify(errors)).toHaveLength(0)
  })

  it('the draft fixture would also pass L1 in publish mode (it is genuinely complete, just marked draft)', () => {
    const issues = validateRecipe(multiTsl2591Recipe, inventory, 'publish')
    const errors = issues.filter((i) => i.severity === 'error')
    expect(errors, JSON.stringify(errors)).toHaveLength(0)
  })
})

describe('canary sensor rationales', () => {
  it('all validate against SensorRationaleSchema', () => {
    for (const r of canaryRationales) {
      expect(SensorRationaleSchema.safeParse(r).success, r.sensorId).toBe(true)
    }
  })

  it('every (sensor, subject) pair reachable from a canary recipe has a rationale', () => {
    const reachable = new Set<string>()
    for (const recipe of recipes) {
      for (const sensorId of recipe.sensors) {
        reachable.add(`${sensorId}::${recipe.subject ?? 'null'}`)
      }
    }
    const covered = new Set(canaryRationales.map((r) => `${r.sensorId}::${r.subject ?? 'null'}`))
    for (const key of reachable) {
      expect(covered.has(key), `missing rationale for ${key}`).toBe(true)
    }
  })
})

describe('canary simStatus fixtures', () => {
  it('validate against SimStatusSchema', () => {
    for (const recipe of recipes) {
      const status = canarySimStatus[recipe.id]
      expect(SimStatusSchema.safeParse(status).success, recipe.id).toBe(true)
    }
  })

  it('verifyHash matches a fresh computeVerifyHash() over the current recipe content', () => {
    for (const recipe of recipes) {
      const fresh = computeVerifyHash(recipe)
      expect(canarySimStatus[recipe.id].verifyHash, recipe.id).toBe(fresh)
    }
  })

  it('verifyHash changes when the sketch changes (proves the hash is not a constant)', () => {
    const mutated = { ...pendulumRecipe, sketch: pendulumRecipe.sketch + '\n// changed' }
    expect(computeVerifyHash(mutated)).not.toBe(computeVerifyHash(pendulumRecipe))
  })

  it('simPass is null (not false) for the sensor with no simulation support yet', () => {
    expect(canarySimStatus[multiTsl2591Recipe.id].simPass).toBeNull()
  })
})
