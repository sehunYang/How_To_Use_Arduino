import { describe, expect, it } from 'vitest'
import { sensors } from '@/data/inventory-seed/sensors'
import { RecipeSchema } from '@/schema'
import { buildDiagram } from '@/wokwi/buildDiagram'
import { phase6PhysicsRecipes, phase6PinRecipes, phase6Recipes } from '.'

describe('Phase 6 recipe expansion', () => {
  it('contains the approved pin-coverage and current-inventory physics groups', () => {
    expect(phase6PinRecipes).toHaveLength(6)
    expect(phase6PhysicsRecipes).toHaveLength(35)
    expect(phase6Recipes).toHaveLength(41)
    expect(new Set(phase6Recipes.map((recipe) => recipe.id)).size).toBe(41)
  })

  it('parses every recipe and preserves draft review state', () => {
    for (const recipe of phase6Recipes) {
      expect(RecipeSchema.safeParse(recipe).success, recipe.id).toBe(true)
      expect(recipe.status, recipe.id).toBe('draft')
      expect(recipe.reviewedOnDevice, recipe.id).toBeNull()
      expect(recipe.commentReviewed, recipe.id).toBeNull()
      expect(recipe.body, recipe.id).toContain('## 변인')
      expect(recipe.body, recipe.id).toContain('## 데이터 처리')
    }
  })

  it('resolves every endpoint into a complete breadboard diagram', () => {
    for (const recipe of phase6Recipes) {
      const diagram = buildDiagram(recipe, sensors)
      expect(diagram.parts.some((part) => part.id === 'bb'), recipe.id).toBe(true)
      expect(diagram.connections.length, recipe.id).toBeGreaterThanOrEqual(recipe.wiring.length)
    }
  })

  it('covers every formerly unused pin in a real recipe connection', () => {
    const endpoints = new Set(
      phase6PinRecipes.flatMap((recipe) =>
        recipe.wiring.flatMap((step) => [step.from, step.to]),
      ),
    )
    for (const endpoint of [
      'TSL2591.3VO',
      'TSL2591.INT',
      'MPU6050_1.AD0',
      'MPU6050_2.AD0',
      'MPU6050.INT',
      'MPU6050.XDA',
      'MPU6050.XCL',
      'TCA9548A_1.RST',
      'TCA9548A_1.A0',
      'TCA9548A_1.A1',
      'TCA9548A_1.A2',
      ...Array.from({ length: 8 }, (_, channel) => `TCA9548A.SD${channel}`),
      ...Array.from({ length: 8 }, (_, channel) => `TCA9548A.SC${channel}`),
    ]) {
      expect(endpoints.has(endpoint), endpoint).toBe(true)
    }
  })
})
