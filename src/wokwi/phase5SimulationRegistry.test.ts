import { describe, expect, it } from 'vitest'
import { sensors } from '@/data/inventory-seed/sensors'
import { phase5Recipes } from '@/data/phase5'
import { buildDiagram } from './buildDiagram'
import {
  PHASE5_SIMULATION_TIMEOUT_CAP_MS,
  phase5SimulationRegistry,
} from './phase5SimulationRegistry'

describe('Phase 5 Wokwi simulation registry', () => {
  it('classifies every Phase 5 recipe exactly once', () => {
    expect(phase5SimulationRegistry).toHaveLength(34)
    expect(phase5SimulationRegistry.map((entry) => entry.recipeId))
      .toEqual(phase5Recipes.map((recipe) => recipe.id))
    expect(new Set(phase5SimulationRegistry.map((entry) => entry.recipeId)).size).toBe(34)
  })

  it('derives eligible entries and truthful exclusions from sensor support', () => {
    const eligible = phase5SimulationRegistry.filter((entry) => entry.eligible)
    const planned = phase5SimulationRegistry.filter((entry) => !entry.eligible)

    expect(eligible).toHaveLength(28)
    expect(planned).toHaveLength(6)
    expect(planned.map((entry) => entry.recipeId)).toEqual([
      'S4',
      'S9',
      'e5-spatial-light-map',
      'night-activity',
      'light-follow-car',
      'smart-lighting',
    ])
  })

  it('provides unique deterministic scenarios within the timeout cap', () => {
    const eligible = phase5SimulationRegistry.filter((entry) => entry.eligible)
    const scenarioIds = eligible.map((entry) => entry.scenario.id)

    expect(new Set(scenarioIds).size).toBe(eligible.length)
    for (const entry of eligible) {
      expect(entry.status).toBe('eligible')
      expect(entry.timeoutMs).toBeGreaterThan(0)
      expect(entry.timeoutMs).toBeLessThanOrEqual(PHASE5_SIMULATION_TIMEOUT_CAP_MS)
      expect(entry.scenario).toEqual({
        id: `phase5/${entry.recipeId}/smoke-v1`,
        kind: 'deterministic-smoke',
        seed: expect.any(Number),
        sensorIds: [...entry.scenario.sensorIds].sort(),
      })
    }
  })

  it('builds a Wokwi diagram for every eligible recipe', () => {
    const recipesById = new Map(phase5Recipes.map((recipe) => [recipe.id, recipe]))
    const eligible = phase5SimulationRegistry.filter((entry) => entry.eligible)

    const diagrams = eligible.map((entry) => {
      const recipe = recipesById.get(entry.recipeId)
      expect(recipe, `missing Phase 5 recipe ${entry.recipeId}`).toBeDefined()
      return buildDiagram(recipe!, sensors)
    })

    expect(diagrams).toHaveLength(28)
    expect(diagrams.every((diagram) => diagram.parts.length > 1)).toBe(true)
  })

  it('records the unsupported sensor and an explicit exclusion reason', () => {
    const planned = phase5SimulationRegistry.filter((entry) => !entry.eligible)

    for (const entry of planned) {
      expect(entry.status).toBe('planned')
      expect(entry.unsupportedSensorIds.length).toBeGreaterThan(0)
      expect(entry.exclusionReason).toContain(entry.unsupportedSensorIds[0])
    }
  })
})
