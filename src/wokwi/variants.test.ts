import { describe, expect, it } from 'vitest'
import { sensors } from '@/data/inventory-seed/sensors'
import { phase5BehaviorSpecById } from './behaviorSpecs'
import { buildPhase5WokwiProjects } from './phase5ProjectGenerator'
import { type EligiblePhase5Simulation, simulationPhases } from './phase5SimulationRegistry'
import { buildWokwiVariants, VARIANT_EXPECTATIONS } from './variants'

const variants = buildWokwiVariants(
  simulationPhases.flatMap(({ root, recipes, registry }) =>
    buildPhase5WokwiProjects(
      registry.filter((entry): entry is EligiblePhase5Simulation => entry.eligible),
      recipes,
      sensors,
      root,
    )),
  { allowedComments: (recipeId) => phase5BehaviorSpecById.get(recipeId)?.allowedComments ?? [] },
)

describe('fault variant expectations', () => {
  it('only name variants that exist', () => {
    const ids = new Set(variants.map((variant) => variant.id))
    for (const id of Object.keys(VARIANT_EXPECTATIONS)) expect(ids.has(id), id).toBe(true)
  })

  it('use outcomes the judges can produce', () => {
    const outcomes = new Set(['diagnosed', 'no-data', 'silent', 'steady', 'chatter'])
    for (const [id, outcome] of Object.entries(VARIANT_EXPECTATIONS)) expect(outcomes.has(outcome), id).toBe(true)
  })

  it('classify a missing sensor that prints plausible numbers as silent', () => {
    const variant = variants.find((candidate) => candidate.id === 'S1--unplugged-mpu6050')!
    expect(variant.judge('time_ms,roll_deg,pitch_deg\n100,0.0,0.0\n200,0.0,0.0\n').outcome).toBe('silent')
    expect(variant.judge('time_ms,roll_deg,pitch_deg\n100,nan,0.0\n').outcome).toBe('diagnosed')
    expect(variant.judge('# MPU6050_ERROR\n').outcome).toBe('diagnosed')
  })
})
