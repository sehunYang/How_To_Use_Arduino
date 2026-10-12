import { sensors } from '@/data/inventory-seed/sensors'
import { phase5Recipes } from '@/data/phase5'
import { phase6Recipes } from '@/data/phase6'
import { phase7Recipes } from '@/data/phase7'
import type { Recipe } from '@/schema'

export const PHASE5_SIMULATION_TIMEOUT_CAP_MS = 20_000

export interface Phase5SimulationScenario {
  /** Stable automation case identifier; this is not a Wokwi run result. */
  id: string
  kind: 'deterministic-smoke'
  seed: number
  sensorIds: string[]
}

export interface EligiblePhase5Simulation {
  recipeId: string
  eligible: true
  /** Sensor capability is sufficient; project generation and execution remain separate gates. */
  status: 'eligible'
  timeoutMs: number
  scenario: Phase5SimulationScenario
}

export interface PlannedPhase5Simulation {
  recipeId: string
  eligible: false
  /** Automation remains planned until every referenced sensor is supported. */
  status: 'planned'
  unsupportedSensorIds: string[]
  exclusionReason: string
}

export type Phase5SimulationRegistryEntry =
  | EligiblePhase5Simulation
  | PlannedPhase5Simulation

function stableSeed(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

const sensorById = new Map(sensors.map((sensor) => [sensor.id, sensor]))

function buildSimulationRegistry(phase: string, recipes: readonly Recipe[]): Phase5SimulationRegistryEntry[] {
  return recipes.map((recipe) => {
    const unsupportedSensorIds = recipe.sensors
      .filter((sensorId) => sensorById.get(sensorId)?.wokwi.simSupported !== true)
      .sort()

    if (unsupportedSensorIds.length > 0) {
      return {
        recipeId: recipe.id,
        eligible: false,
        status: 'planned',
        unsupportedSensorIds,
        exclusionReason: `Wokwi simulation unsupported for sensor(s): ${unsupportedSensorIds.join(', ')}`,
      }
    }

    return {
      recipeId: recipe.id,
      eligible: true,
      status: 'eligible',
      timeoutMs: PHASE5_SIMULATION_TIMEOUT_CAP_MS,
      scenario: {
        id: `${phase}/${recipe.id}/smoke-v1`,
        kind: 'deterministic-smoke',
        seed: stableSeed(recipe.id),
        sensorIds: [...recipe.sensors].sort(),
      },
    }
  })
}

export const phase5SimulationRegistry = buildSimulationRegistry('phase5', phase5Recipes)

/**
 * Every recipe set that gets generated Wokwi projects. The pipeline grew up on
 * Phase 5, hence its names; each phase keeps its own directory and manifest.
 */
export interface SimulationPhase {
  phase: 'phase5' | 'phase6' | 'phase7'
  root: string
  recipes: readonly Recipe[]
  registry: Phase5SimulationRegistryEntry[]
}

export const simulationPhases: readonly SimulationPhase[] = [
  { phase: 'phase5', root: 'wokwi/phase5', recipes: phase5Recipes, registry: phase5SimulationRegistry },
  { phase: 'phase6', root: 'wokwi/phase6', recipes: phase6Recipes, registry: buildSimulationRegistry('phase6', phase6Recipes) },
  { phase: 'phase7', root: 'wokwi/phase7', recipes: phase7Recipes, registry: buildSimulationRegistry('phase7', phase7Recipes) },
]
