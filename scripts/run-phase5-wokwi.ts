#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { phase5BehaviorSpecById } from '../src/wokwi/behaviorSpecs'
import { checkSerialBehavior, serialFromCliOutput } from '../src/wokwi/serialBehavior'
import { selectPhase5Projects, type SelectableProject } from '../src/wokwi/phase5Selection'
import { simulationPhases } from '../src/wokwi/phase5SimulationRegistry'
import { buildPhase5WokwiProjects } from '../src/wokwi/phase5ProjectGenerator'
import { sensors } from '../src/data/inventory-seed/sensors'
import {
  buildWokwiVariants,
  VARIANT_EXPECTATIONS,
  VARIANTS_ROOT,
  type VariantManifestEntry,
} from '../src/wokwi/variants'

interface ManifestProject extends SelectableProject {
  path: string
  kind: 'behavior' | 'smoke'
  timeoutMs: number
  scenario: string
}

if (!process.env.WOKWI_CLI_TOKEN) {
  console.error('WOKWI_CLI_TOKEN is required to run the Wokwi scenarios.')
  process.exit(1)
}

function git(...args: string[]): string | undefined {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  return result.status === 0 ? result.stdout : undefined
}

// `--changed-against <ref>` (pull requests): simulate only what the diff can affect.
const refFlag = process.argv.indexOf('--changed-against')
const baseRef = refFlag === -1 ? undefined : process.argv[refFlag + 1]
const changedFiles = baseRef === undefined ? undefined : git('diff', '--name-only', baseRef, 'HEAD')
if (baseRef && changedFiles === undefined) {
  throw new Error(`git diff against ${baseRef} failed; fetch the base branch first`)
}

const projects: ManifestProject[] = []
for (const { phase, root } of simulationPhases) {
  const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8')) as {
    projects: ManifestProject[]
  }
  if (!baseRef || changedFiles === undefined) {
    projects.push(...manifest.projects)
    continue
  }
  const baseManifest = git('show', `${baseRef}:${root}/manifest.json`)
  const base = baseManifest === undefined
    ? undefined
    : (JSON.parse(baseManifest) as { projects: SelectableProject[] }).projects
  const selection = selectPhase5Projects(changedFiles.split('\n').filter(Boolean), manifest.projects, base)
  console.log(`${phase} changed against ${baseRef}: ${selection.ids.length} of ${manifest.projects.length} projects to simulate.`)
  for (const id of selection.ids) console.log(`  - ${id}: ${selection.reasons[id]}`)
  projects.push(...manifest.projects.filter((project) => selection.ids.includes(project.id)))
}

// Run every project and report all failures together, so one CI run shows them all.
const failed: string[] = []
for (const project of projects) {
  console.log(`Running ${project.id} [${project.kind}] (${project.timeoutMs}ms cap)...`)
  const args = [project.path, '--scenario', project.scenario, '--timeout', String(project.timeoutMs)]
  // Behaviour runs capture stdout to judge it; see serialFromCliOutput for why not --serial-log-file.
  const behavior = project.kind === 'behavior'
  const result = spawnSync('wokwi-cli', args, {
    encoding: 'utf8',
    stdio: behavior ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.error) throw result.error
  if (behavior) process.stdout.write(result.stdout)
  if (result.status !== 0) {
    failed.push(`${project.id}: wokwi-cli exited with ${result.status}`)
    continue
  }

  if (behavior) {
    const spec = phase5BehaviorSpecById.get(project.id)
    if (!spec) throw new Error(`No behaviour spec for ${project.id}; regenerate the Wokwi projects`)
    const verdict = checkSerialBehavior(spec, serialFromCliOutput(result.stdout, spec.header.split(',').length))
    if (!verdict.ok) {
      console.error(`${project.id}: serial behaviour check failed (${verdict.rows} rows)`)
      for (const failure of verdict.failures) console.error(`  - ${failure}`)
      failed.push(`${project.id}: ${verdict.failures.length} behaviour failure(s)`)
      continue
    }
    console.log(`${project.id}: ${verdict.rows} rows matched the physical stimulus`)
  }
}

// Fault variants: the same firmware facing a missing sensor, a different I2C address, or noise.
const variantManifest = JSON.parse(readFileSync(resolve(VARIANTS_ROOT, 'manifest.json'), 'utf8')) as {
  variants: VariantManifestEntry[]
}
let variants = variantManifest.variants
if (baseRef && changedFiles !== undefined) {
  const baseManifest = git('show', `${baseRef}:${VARIANTS_ROOT}/manifest.json`)
  const base = baseManifest === undefined
    ? undefined
    : (JSON.parse(baseManifest) as { variants: SelectableProject[] }).variants
  const selection = selectPhase5Projects(changedFiles.split('\n').filter(Boolean), variants, base)
  console.log(`variants changed against ${baseRef}: ${selection.ids.length} of ${variants.length} to simulate.`)
  variants = variants.filter((variant) => selection.ids.includes(variant.id))
}
const judges = new Map(
  buildWokwiVariants(
    simulationPhases.flatMap(({ root, recipes, registry }) =>
      buildPhase5WokwiProjects(registry.filter((entry) => entry.eligible), recipes, sensors, root)),
    { allowedComments: (recipeId) => phase5BehaviorSpecById.get(recipeId)?.allowedComments ?? [] },
  ).map((variant) => [variant.id, variant]),
)
const outcomes: string[] = []
for (const entry of variants) {
  const variant = judges.get(entry.id)
  if (!variant) throw new Error(`No variant definition for ${entry.id}; regenerate the Wokwi projects`)
  console.log(`Running ${entry.id} [${entry.kind}] (${entry.timeoutMs}ms cap)...`)
  const result = spawnSync(
    'wokwi-cli',
    [entry.path, '--scenario', entry.scenario, '--timeout', String(entry.timeoutMs)],
    { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'], shell: process.platform === 'win32' },
  )
  if (result.error) throw result.error
  process.stdout.write(result.stdout)
  if (result.status !== 0) {
    failed.push(`${entry.id}: wokwi-cli exited with ${result.status}`)
    continue
  }
  const spec = phase5BehaviorSpecById.get(entry.recipeId)
  const verdict = variant.judge(serialFromCliOutput(result.stdout, spec?.header.split(',').length))
  const expected = VARIANT_EXPECTATIONS[entry.id]
  outcomes.push(`  '${entry.id}': '${verdict.outcome}', // ${verdict.evidence}`)
  if (verdict.outcome !== expected) {
    failed.push(`${entry.id}: ${verdict.outcome} (${verdict.evidence}), expected ${expected ?? 'an entry in VARIANT_EXPECTATIONS'}`)
  }
}
if (outcomes.length > 0) {
  console.log('\nVariant outcomes (VARIANT_EXPECTATIONS format):')
  for (const line of outcomes) console.log(line)
}

if (failed.length > 0) {
  console.error(`\n${failed.length} of ${projects.length} Wokwi projects failed:`)
  for (const failure of failed) console.error(`  - ${failure}`)
  process.exit(1)
}

const behaviorCount = projects.filter((project) => project.kind === 'behavior').length
console.log(
  `Passed ${projects.length} Wokwi scenarios ` +
    `(${behaviorCount} behaviour, ${projects.length - behaviorCount} boot smoke).`,
)
