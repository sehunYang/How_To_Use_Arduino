import { describe, expect, it } from 'vitest'
import { pendulumRecipe } from '@/data/canary/pendulum'
import type { ReadableLayout } from './readableLayout'
import { layoutForRecipe } from './layoutRegistry'

describe('layoutForRecipe', () => {
  it('uses the registered layout for bundled recipes', () => {
    expect(layoutForRecipe(pendulumRecipe)?.wires).toHaveLength(pendulumRecipe.wiring.length)
  })

  it('uses an embedded validated layout for dynamic recipe previews', () => {
    const layout: ReadableLayout = {
      version: 1,
      author: 'teacher',
      purpose: 'recipe',
      minimumClearance: 8,
      parts: [{ id: 'uno', type: 'wokwi-arduino-uno', top: 0, left: 0 }],
      wires: [],
    }

    expect(layoutForRecipe({ ...pendulumRecipe, id: 'remote-recipe', layout })).toBe(layout)
  })

  it('lets an embedded layout override the bundled layout during admin preview', () => {
    const layout: ReadableLayout = {
      version: 1,
      author: 'teacher',
      purpose: 'recipe',
      minimumClearance: 8,
      parts: [{ id: 'uno', type: 'wokwi-arduino-uno', top: 0, left: 0 }],
      wires: [],
    }

    expect(layoutForRecipe({ ...pendulumRecipe, layout })).toBe(layout)
  })
})
