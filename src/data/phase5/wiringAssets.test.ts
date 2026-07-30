import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { phase5Recipes } from '.'

describe('Phase 5 wiring artifacts', () => {
  it('uses one generated wiring artifact per canonical recipe', () => {
    expect(new Set(phase5Recipes.map((recipe) => recipe.imageUrl)).size).toBe(34)
    for (const recipe of phase5Recipes) {
      expect(existsSync(`public/${recipe.imageUrl}`), recipe.imageUrl).toBe(true)
    }
  })

  it('keeps every focus rectangle within its declared image', () => {
    for (const recipe of phase5Recipes) {
      for (const step of recipe.wiring) {
        expect(step.focus.x, recipe.id).toBeGreaterThanOrEqual(0)
        expect(step.focus.y, recipe.id).toBeGreaterThanOrEqual(0)
        expect(step.focus.x + step.focus.w, recipe.id).toBeLessThanOrEqual(recipe.imageWidth)
        expect(step.focus.y + step.focus.h, recipe.id).toBeLessThanOrEqual(recipe.imageHeight)
      }
    }
  })
})
