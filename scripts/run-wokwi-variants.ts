#!/usr/bin/env tsx
/**
 * Runs only the fault variants (wokwi/variants) and prints their outcomes, for
 * a characterisation run without re-simulating every behaviour project:
 *   npx tsx scripts/run-wokwi-variants.ts [--kind unplugged|i2c-address|jitter]
 *
 * Expects firmware staged by `npm run build:wokwi:phase5`. Exits non-zero only
 * if a variant contradicts an outcome already recorded in VARIANT_EXPECTATIONS
 * or wokwi-cli itself fails.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sensors } from '../src/data/inventory-seed/sensors'
import { phase5BehaviorSpecById } from '../src/wokwi/behaviorSpecs'
import { buildPhase5WokwiProjects } from '../src/wokwi/phase5ProjectGenerator'
import { type EligiblePhase5Simulation, simulationPhases } from '../src/wokwi/phase5SimulationRegistry'
import { serialFromCliOutput } from '../src/wokwi/serialBehavior'
import {
  buildWokwiVariants,
  VARIANT_EXPECTATIONS,
  type VariantManifestEntry,
  VARIANTS_ROOT,
} from '../src/wokwi/variants'
import { simulate } from './wokwi-simulate'

if (!process.env.WOKWI_CLI_TOKEN) {
  console.error('WOKWI_CLI_TOKEN is required to run the Wokwi scenarios.')
  process.exit(1)
}

const kindFlag = process.argv.indexOf('--kind')
const kind = kindFlag === -1 ? undefined : process.argv[kindFlag + 1]
const manifest = JSON.parse(readFileSync(resolve(VARIANTS_ROOT, 'manifest.json'), 'utf8')) as {
  variants: VariantManifestEntry[]
}
const entries = manifest.variants.filter((entry) => kind === undefined || entry.kind === kind)

const definitions = new Map(
  buildWokwiVariants(
    simulationPhases.flatMap(({ root, recipes, registry }) =>
      buildPhase5WokwiProjects(
        registry.filter((entry): entry is EligiblePhase5Simulation => entry.eligible),
        recipes,
        sensors,
        root,
      )),
    { allowedComments: (recipeId) => phase5BehaviorSpecById.get(recipeId)?.allowedComments ?? [] },
  ).map((variant) => [variant.id, variant]),
)

const failed: string[] = []
const outcomes: Array<{ entry: VariantManifestEntry; outcome: string; evidence: string }> = []
for (const entry of entries) {
  const variant = definitions.get(entry.id)
  if (!variant) throw new Error(`No variant definition for ${entry.id}; regenerate the Wokwi projects`)
  console.log(`Running ${entry.id} [${entry.kind}] (${entry.timeoutMs}ms cap)...`)
  const result = simulate([entry.path, '--scenario', entry.scenario, '--timeout', String(entry.timeoutMs)])
  if (result.status !== 0) {
    failed.push(`${entry.id}: wokwi-cli exited with ${result.status}`)
    continue
  }
  const header = phase5BehaviorSpecById.get(entry.recipeId)?.header
  const verdict = variant.judge(serialFromCliOutput(result.stdout, header?.split(',').length))
  outcomes.push({ entry, ...verdict })
  const expected = VARIANT_EXPECTATIONS[entry.id]
  if (expected !== undefined && verdict.outcome !== expected) {
    failed.push(`${entry.id}: ${verdict.outcome} (${verdict.evidence}), expected ${expected}`)
  }
}

console.log('\nVariant outcomes (VARIANT_EXPECTATIONS format):')
for (const { entry, outcome, evidence } of outcomes) console.log(`  '${entry.id}': '${outcome}', // ${evidence}`)

console.log('\nSummary:')
const tally = new Map<string, string[]>()
for (const { entry, outcome } of outcomes) {
  const key = `${entry.kind} → ${outcome}`
  tally.set(key, [...(tally.get(key) ?? []), entry.id])
}
for (const [key, ids] of [...tally].sort()) console.log(`  ${key}: ${ids.length}`)

if (failed.length > 0) {
  console.error(`\n${failed.length} of ${entries.length} variant runs failed:`)
  for (const failure of failed) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log(`\nRan ${entries.length} variants.`)
