import { describe, expect, it } from 'vitest'
import { pendulumRecipe } from '@/data/canary/pendulum'
import { sensors } from '@/data/inventory-seed/sensors'
import { actuators } from '@/data/inventory-seed/actuators'
import { canarySimStatus } from '@/data/canary/simStatus'
import { mapZodFieldErrors, recipeVerifyHash, validateDraft, validatePublish } from './authoring'
import { RecipeSchema } from '@/schema'

const inventory = { sensors, actuators }
const inventoryVersion = 'inventory-test'

describe('admin authoring validation', () => {
  it('maps nested schema errors to exact form paths', () => {
    const parsed = RecipeSchema.safeParse({
      ...pendulumRecipe,
      wiring: [{ ...pendulumRecipe.wiring[0], focus: { x: 0, y: 0, w: 0, h: 10 } }],
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(mapZodFieldErrors(parsed.error)).toHaveProperty('wiring[0].focus.w')
    }
  })

  it('returns draft L1 findings as nonblocking warnings', () => {
    const result = validateDraft({ ...pendulumRecipe, wiring: [] }, inventory, inventoryVersion)
    expect(result.canSave).toBe(true)
    expect(result.issues.every((issue) => issue.severity === 'warning')).toBe(true)
  })

  it('requires a current, passing verification ledger to publish', () => {
    const draft = {
      ...pendulumRecipe,
      reviewedOnDevice: null,
      commentReviewed: null,
    }
    const stale = validatePublish(draft, inventory, inventoryVersion, canarySimStatus[pendulumRecipe.id])
    expect(stale.canPublish).toBe(false)
    expect(stale.issues.map((issue) => issue.code)).toContain('verification-stale')

    const verifyHash = recipeVerifyHash(draft, inventoryVersion)
    const reviewed = {
      ...draft,
      reviewedOnDevice: { at: '2026-01-01T00:00:00.000Z', verifyHash },
      commentReviewed: { at: '2026-01-01T00:00:00.000Z', verifyHash },
    }
    const passing = validatePublish(reviewed, inventory, inventoryVersion, {
      verifyHash,
      compilePass: true,
      simPass: true,
      logicPass: true,
      staticIssues: [],
      verifiedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(passing.canPublish).toBe(true)
  })
})
