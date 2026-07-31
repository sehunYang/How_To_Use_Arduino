import { describe, expect, it } from 'vitest'
import { phase5Recipes } from '@/data/phase5'
import { phase6Recipes } from '@/data/phase6'

const recipes = [...phase5Recipes, ...phase6Recipes]

function setupBlock(sketch: string) {
  return /void setup\(\)\s*\{([\s\S]*?)\n\}/.exec(sketch)?.[1] ?? ''
}

describe('student recipe serial CSV contract', () => {
  it('covers every Phase 5 and Phase 6 recipe', () => {
    expect(phase5Recipes).toHaveLength(34)
    expect(phase6Recipes).toHaveLength(41)
    expect(recipes).toHaveLength(75)
  })

  it('prints exactly one non-diagnostic CSV header before measurements', () => {
    for (const recipe of recipes) {
      const setup = setupBlock(recipe.sketch)
      const literalLines = [...setup.matchAll(/Serial\.println\("([^"]+)"\)/g)].map((match) => match[1])
      const headers = literalLines.filter((line) => !line.startsWith('#'))
      expect(headers, recipe.id).toHaveLength(1)
      expect(headers[0].split(',').every((column) => column.trim().length > 0), recipe.id).toBe(true)
      expect(headers[0].endsWith(','), recipe.id).toBe(false)
    }
  })

  it('does not emit key=value records or trailing separators', () => {
    for (const recipe of recipes) {
      expect(recipe.sketch, recipe.id).not.toMatch(/Serial\.(?:print|println)\("[^"\n]*=[^"\n]*"\)/)
      expect(recipe.sketch, recipe.id).not.toMatch(/Serial\.println\([^;]+\);\s*Serial\.print\(','\)/)
      expect(recipe.sketch, recipe.id).not.toMatch(/Serial\.println\("[^"]*,"\)/)
    }
  })
})
