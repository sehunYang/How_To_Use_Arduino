import type { SimStatus } from '@/schema'
import { computeVerifyHash } from '@/lib/verifyHash'
import { INVENTORY_VERSION } from '@/data/inventory-seed/version'
import { pendulumRecipe } from './pendulum'
import { multiTsl2591Recipe } from './multiTsl2591'
import { ina219CurrentRecipe } from './ina219Current'

function statusFor(
  recipe: { sketch: string; wiring: unknown; layout?: unknown; tunables: unknown; baudRate: number },
  simPass: boolean | null,
): SimStatus {
  return {
    verifyHash: computeVerifyHash({ ...recipe, inventoryVersion: INVENTORY_VERSION }),
    compilePass: true,
    simPass,
    logicPass: true,
    staticIssues: [],
    verifiedAt: '2026-01-01T00:00:00.000Z',
  }
}

export const canarySimStatus: Record<string, SimStatus> = {
  // MPU6050 has a native Wokwi part (simSupported: true in the inventory).
  [pendulumRecipe.id]: statusFor(pendulumRecipe, true),
  // GitHub Actions run 30281813853 observed the INA219 recipe scenario pass.
  [ina219CurrentRecipe.id]: statusFor(ina219CurrentRecipe, true),
  // The recipe still depends on the unsupported TCA9548A multiplexer, so its
  // custom TSL2591 parts alone are not enough for an end-to-end simulation.
  [multiTsl2591Recipe.id]: statusFor(multiTsl2591Recipe, null),
}
