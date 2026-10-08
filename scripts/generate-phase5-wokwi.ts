#!/usr/bin/env tsx
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { sensors } from '../src/data/inventory-seed/sensors'
import {
  buildPhase5WokwiManifest,
  buildPhase5WokwiProjects,
  renderPhase5Scenario,
  renderPhase5WokwiToml,
} from '../src/wokwi/phase5ProjectGenerator'
import { simulationPhases } from '../src/wokwi/phase5SimulationRegistry'

const check = process.argv.includes('--check')
let stale = false

for (const { phase, root: rootPath, recipes, registry } of simulationPhases) {
  const eligible = registry.filter((entry) => entry.eligible)
  const exclusions = registry
    .filter((entry) => !entry.eligible)
    .map((entry) => entry.recipeId)
  const projects = buildPhase5WokwiProjects(eligible, recipes, sensors, rootPath)
  const root = resolve(rootPath)

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

  if (check) {
    const directoryNames = await readdir(root, { withFileTypes: true })
      .then((items) => items.filter((item) => item.isDirectory()).map((item) => item.name).sort())
      .catch(() => [])
    const expectedNames = projects.map((project) => project.id).sort()
    if (JSON.stringify(directoryNames) !== JSON.stringify(expectedNames)) {
      console.error(`${rootPath} must contain exactly ${expectedNames.length} eligible project directories.`)
      stale = true
    }

    for (const [relativePath, expected] of outputs) {
      const current = await readFile(resolve(relativePath), 'utf8').catch(() => null)
      if (current !== expected) {
        console.error(`${relativePath} is stale. Run: npm run generate:wokwi:phase5`)
        stale = true
      }
    }
    if (!stale) console.log(`Verified ${projects.length} generated ${phase} Wokwi project/scenario pairs.`)
  } else {
    await rm(root, { recursive: true, force: true })
    for (const [relativePath, content] of outputs) {
      const absolutePath = resolve(relativePath)
      await mkdir(dirname(absolutePath), { recursive: true })
      await writeFile(absolutePath, content, 'utf8')
    }
    console.log(
      `Generated ${projects.length} ${phase} Wokwi projects; excluded ${exclusions.join(', ') || 'none'}.`,
    )
  }
}

if (stale) process.exit(1)
