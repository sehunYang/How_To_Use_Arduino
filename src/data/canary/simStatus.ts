import type { SimStatus } from '@/schema'
import { computeVerifyHash } from '@/lib/verifyHash'
import { pendulumRecipe } from './pendulum'
import { multiTsl2591Recipe } from './multiTsl2591'

function statusFor(recipe: { sketch: string; wiring: unknown; tunables: unknown; baudRate: number }, simPass: boolean | null): SimStatus {
  return {
    verifyHash: computeVerifyHash(recipe),
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
  // TSL2591 has no native/custom Wokwi chip yet (simSupported: false) —
  // simPass is null, meaning "not simulated", not "failed" (plan schema note).
  [multiTsl2591Recipe.id]: statusFor(multiTsl2591Recipe, null),
}
