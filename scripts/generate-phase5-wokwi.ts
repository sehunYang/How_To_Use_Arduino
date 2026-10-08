#!/usr/bin/env tsx
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { sensors } from '../src/data/inventory-seed/sensors'
import { phase5BehaviorSpecById } from '../src/wokwi/behaviorSpecs'
import {
  buildPhase5WokwiManifest,
  buildPhase5WokwiProjects,
  type Phase5WokwiProject,
  renderPhase5Scenario,
  renderPhase5WokwiToml,
  renderScenario,
} from '../src/wokwi/phase5ProjectGenerator'
import { simulationPhases } from '../src/wokwi/phase5SimulationRegistry'
import { buildVariantManifest, buildWokwiVariants, VARIANTS_ROOT } from '../src/wokwi/variants'

const check = process.argv.includes('--check')
let stale = false
const allProjects: Phase5WokwiProject[] = []

/** Writes `outputs` under `rootPath`, or with --check reports any that differ. */
async function emit(label: string, rootPath: string, expectedNames: string[], outputs: Map<string, string>) {
  const root = resolve(rootPath)
  if (check) {
    let current = true
    const directoryNames = await readdir(root, { withFileTypes: true })
      .then((items) => items.filter((item) => item.isDirectory()).map((item) => item.name).sort())
      .catch(() => [])
    if (JSON.stringify(directoryNames) !== JSON.stringify([...expectedNames].sort())) {
      console.error(`${rootPath} must contain exactly ${expectedNames.length} project directories.`)
      current = false
    }
    for (const [relativePath, expected] of outputs) {
      const existing = await readFile(resolve(relativePath), 'utf8').catch(() => null)
      if (existing !== expected) {
        console.error(`${relativePath} is stale. Run: npm run generate:wokwi:phase5`)
        current = false
      }
    }
    if (current) console.log(`Verified ${expectedNames.length} generated ${label}.`)
    else stale = true
  } else {
    await rm(root, { recursive: true, force: true })
    for (const [relativePath, content] of outputs) {
      const absolutePath = resolve(relativePath)
      await mkdir(dirname(absolutePath), { recursive: true })
      await writeFile(absolutePath, content, 'utf8')
    }
    console.log(`Generated ${expectedNames.length} ${label}.`)
  }
}

for (const { phase, root: rootPath, recipes, registry } of simulationPhases) {
  const eligible = registry.filter((entry) => entry.eligible)
  const exclusions = registry
    .filter((entry) => !entry.eligible)
    .map((entry) => entry.recipeId)
  const projects = buildPhase5WokwiProjects(eligible, recipes, sensors, rootPath)
  allProjects.push(...projects)

  const outputs = new Map<string, string>()
  for (const project of projects) {
    outputs.set(`${project.path}/diagram.json`, `${JSON.stringify(project.diagram, null, 2)}\n`)
    outputs.set(`${project.path}/wokwi.toml`, renderPhase5WokwiToml(project))
    outputs.set(`${project.path}/scenario.test.yaml`, renderPhase5Scenario(project))
    outputs.set(`${project.path}/${project.id}.ino`, project.sketch)
  }
  outputs.set(
    `${rootPath}/manifest.json`,
    `${JSON.stringify(buildPhase5WokwiManifest(projects, exclusions), null, 2)}\n`,
  )
  await emit(
    `${phase} Wokwi projects (excluded ${exclusions.join(', ') || 'none'})`,
    rootPath,
    projects.map((project) => project.id),
    outputs,
  )
}

// Fault variants reuse each behaviour project's firmware on a modified circuit or stimulus.
const variants = buildWokwiVariants(allProjects, {
  allowedComments: (recipeId) => phase5BehaviorSpecById.get(recipeId)?.allowedComments ?? [],
})
const variantOutputs = new Map<string, string>()
const variantManifest = buildVariantManifest(variants, allProjects)
for (const [index, variant] of variants.entries()) {
  const entry = variantManifest.variants[index]
  variantOutputs.set(`${entry.path}/diagram.json`, `${JSON.stringify(variant.diagram, null, 2)}\n`)
  variantOutputs.set(`${entry.path}/wokwi.toml`, renderPhase5WokwiToml(entry))
  variantOutputs.set(`${entry.path}/scenario.test.yaml`, renderScenario(`Variant - ${variant.id}`, variant.steps))
}
variantOutputs.set(`${VARIANTS_ROOT}/manifest.json`, `${JSON.stringify(variantManifest, null, 2)}\n`)
await emit('Wokwi fault variants', VARIANTS_ROOT, variants.map((variant) => variant.id), variantOutputs)

if (stale) process.exit(1)
