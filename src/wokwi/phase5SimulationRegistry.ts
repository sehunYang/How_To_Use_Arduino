import { sensors } from '@/data/inventory-seed/sensors'
import { phase5Recipes } from '@/data/phase5'

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

export const phase5SimulationRegistry: Phase5SimulationRegistryEntry[] =
  phase5Recipes.map((recipe) => {
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
        id: `phase5/${recipe.id}/smoke-v1`,
        kind: 'deterministic-smoke',
        seed: stableSeed(recipe.id),
        sensorIds: [...recipe.sensors].sort(),
      },
    }
  })
