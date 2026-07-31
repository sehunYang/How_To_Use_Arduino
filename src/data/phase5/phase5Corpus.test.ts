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
      expect(recipe.body, recipe.id).toContain('## 한눈에 보기')
      expect(recipe.body, recipe.id).toContain('## 1. 과학 이론 쉽게 이해하기')
      expect(recipe.body, recipe.id).toContain('실험 실행 계획')
      expect(recipe.body, recipe.id).not.toContain('## 측정 기록표')
      expect(recipe.body, recipe.id).not.toContain('## 계산과 그래프')
      expect(recipe.body, recipe.id).not.toContain('표본 표준편차')
      expect(recipe.body, recipe.id).not.toContain('relative error')
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

  it('derives the Wokwi-capable set from truthful sensor descriptors', () => {
    const sensorById = new Map(sensors.map((sensor) => [sensor.id, sensor]))
    const supported = phase5Recipes.filter((recipe) =>
      recipe.sensors.every((sensorId) => sensorById.get(sensorId)?.wokwi.simSupported === true),
    )
    const unsupported = phase5Recipes
      .filter((recipe) => !supported.includes(recipe))
      .map((recipe) => recipe.id)

    expect(supported).toHaveLength(28)
    expect(unsupported).toEqual([
      'S4',
      'S9',
      'e5-spatial-light-map',
      'night-activity',
      'light-follow-car',
      'smart-lighting',
    ])
  })

  it('keeps recipes aligned with the corrected physical pinouts', () => {
    const endpoints = (recipe: (typeof phase5Recipes)[number]) =>
      recipe.wiring.flatMap((step) => [step.from, step.to])

    for (const recipe of phase5Recipes.filter((entry) => entry.sensors.includes('cds'))) {
      const refs = endpoints(recipe)
      expect(refs.some((ref) => /^CDS(?:_\d+)?\.(?:VCC|GND|AO)$/.test(ref)), recipe.id).toBe(false)
      expect(refs.some((ref) => /^CDS(?:_\d+)?\.L1$/.test(ref)), recipe.id).toBe(true)
      expect(refs.some((ref) => /^CDS(?:_\d+)?\.L2$/.test(ref)), recipe.id).toBe(true)
      expect(refs.some((ref) => /^CDS_RESISTOR(?:_\d+)?\.[12]$/.test(ref)), recipe.id).toBe(true)
    }

    for (const recipe of phase5Recipes.filter((entry) => entry.sensors.includes('ina219'))) {
      const refs = endpoints(recipe)
      expect(refs).toContain('INA219.VIN+')
      expect(refs).toContain('INA219.VIN-')
    }

    for (const recipe of phase5Recipes.filter((entry) => entry.sensors.includes('tsl2591'))) {
      expect(endpoints(recipe).some((ref) => /^TSL2591(?:_\d+)?\.VCC$/.test(ref)), recipe.id)
        .toBe(false)
    }
  })
})
