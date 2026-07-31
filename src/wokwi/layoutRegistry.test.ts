import { describe, expect, it } from 'vitest'
import { pendulumRecipe } from '@/data/canary/pendulum'
import type { ReadableLayout } from './readableLayout'
import { layoutForRecipe } from './layoutRegistry'

describe('layoutForRecipe', () => {
  it('uses the generated breadboard diagram for bundled recipes', () => {
    expect(layoutForRecipe(pendulumRecipe)).toBeNull()
  })

  it('uses an embedded validated layout for dynamic recipe previews', () => {
    const layout: ReadableLayout = {
      version: 1,
      author: 'teacher',
      purpose: 'recipe',
      minimumClearance: 8,
      parts: [
        { id: 'uno', type: 'wokwi-arduino-uno', top: 0, left: 0 },
        { id: 'bb', type: 'wokwi-breadboard-half', top: 0, left: 300 },
      ],
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
      parts: [
        { id: 'uno', type: 'wokwi-arduino-uno', top: 0, left: 0 },
        { id: 'bb', type: 'wokwi-breadboard-half', top: 0, left: 300 },
      ],
      wires: [],
    }

    expect(layoutForRecipe({ ...pendulumRecipe, layout })).toBe(layout)
  })

  it('allows simple UNO signal wires to connect directly', () => {
    const layout: ReadableLayout = {
      version: 1,
      author: 'teacher',
      purpose: 'recipe',
      minimumClearance: 8,
      parts: [
        { id: 'uno', type: 'wokwi-arduino-uno', top: 0, left: 0 },
        { id: 'bb', type: 'wokwi-breadboard-half', top: 0, left: 300 },
        { id: 'sensor', type: 'wokwi-potentiometer', top: 200, left: 300 },
      ],
      wires: [
        {
          id: 'signal',
          net: 'SIG',
          from: 'sensor:SIG',
          to: 'uno:A0',
          color: 'blue',
          points: [],
        },
      ],
    }

    expect(layoutForRecipe({ ...pendulumRecipe, layout })).toBe(layout)
  })

  it('rejects embedded layouts that connect UNO power directly to a component', () => {
    const layout: ReadableLayout = {
      version: 1,
      author: 'teacher',
      purpose: 'recipe',
      minimumClearance: 8,
      parts: [
        { id: 'uno', type: 'wokwi-arduino-uno', top: 0, left: 0 },
        { id: 'bb', type: 'wokwi-breadboard-half', top: 0, left: 300 },
        { id: 'sensor', type: 'wokwi-potentiometer', top: 200, left: 300 },
      ],
      wires: [
        {
          id: 'power',
          net: '5V',
          from: 'uno:5V',
          to: 'sensor:VCC',
          color: 'red',
          points: [],
        },
      ],
    }

    expect(layoutForRecipe({ ...pendulumRecipe, layout })).toBeNull()
  })
})
