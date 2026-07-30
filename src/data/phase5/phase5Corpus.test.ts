import { describe, expect, it } from 'vitest'
import { actuators } from '@/data/inventory-seed/actuators'
import { sensors } from '@/data/inventory-seed/sensors'
import { validateCorpus } from '@/validation/corpusCheck'
import { phase5Rationales, phase5Recipes } from '.'

const distribution = {
  물리: 8,
  '화학·환경': 6,
  생물: 4,
  '공학·로봇': 6,
} as const

describe('complete Phase 5 corpus', () => {
  it('contains exactly 10 sensor examples and 24 project recipes', () => {
    expect(phase5Recipes).toHaveLength(34)
    expect(phase5Recipes.filter((recipe) => recipe.type === 'sensor-example')).toHaveLength(10)
    expect(phase5Recipes.filter((recipe) => recipe.type === 'project')).toHaveLength(24)
    expect(new Set(phase5Recipes.map((recipe) => recipe.id)).size).toBe(34)
  })

  it('keeps unreviewed authored content in draft state', () => {
    for (const recipe of phase5Recipes) {
      expect(recipe.status, recipe.id).toBe('draft')
      expect(recipe.reviewedOnDevice, recipe.id).toBeNull()
      expect(recipe.commentReviewed, recipe.id).toBeNull()
    }
  })

  it('meets release corpus distribution, inventory coverage and rationale coverage', () => {
    const reviewedProjection = phase5Recipes.map((recipe) => ({
      ...recipe,
      status: 'published' as const,
    }))
    expect(validateCorpus(
      reviewedProjection,
      { sensors, actuators },
      distribution,
      phase5Rationales,
    )).toEqual([])
  })

  it('derives the planned 32/34 Wokwi-capable set from sensor descriptors', () => {
    const sensorById = new Map(sensors.map((sensor) => [sensor.id, sensor]))
    const supported = phase5Recipes.filter((recipe) =>
      recipe.sensors.every((sensorId) => sensorById.get(sensorId)?.wokwi.simSupported === true),
    )
    const unsupported = phase5Recipes
      .filter((recipe) => !supported.includes(recipe))
      .map((recipe) => recipe.id)

    expect(supported).toHaveLength(32)
    expect(unsupported).toEqual(['S9', 'e5-spatial-light-map'])
  })
})
