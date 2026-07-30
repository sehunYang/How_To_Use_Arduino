#!/usr/bin/env tsx
/**
 * Builds the Uno firmware every Wokwi project needs, straight from the same
 * sketch string the rest of the pipeline verifies:
 *
 *   pendulum         -> pendulumRecipe.sketch   (the recipe students are shown)
 *   ina219-current   -> ina219CurrentRecipe.sketch
 *   chip-conformance -> the INA219/TSL2591/BME280 verification fixture
 *
 * Output lands in .tools/wokwi/<id>/, which each project's wokwi.toml points at.
 * .tools/ is never committed; CI rebuilds it every run.
 */
import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { ina219CurrentRecipe, pendulumRecipe } from '../src/data/canary'
import { chipConformanceFixture } from '../src/wokwi/fixtures/chipConformance'
import { stageSketch } from '../src/verification/compileCheck'
import {
  arduinoCliBin,
  arduinoEnv,
  isArduinoCliInstalled,
  SETUP_HINT,
  toolsDir,
} from '../src/verification/arduinoCli'

if (!isArduinoCliInstalled()) {
  console.error(SETUP_HINT)
  process.exit(1)
}

const projects: {
  id: string
  sketch: string
  projectDir?: string
  chips?: readonly string[]
}[] = [
  { id: pendulumRecipe.id, sketch: pendulumRecipe.sketch },
  {
    id: ina219CurrentRecipe.id,
    sketch: ina219CurrentRecipe.sketch,
    projectDir: 'wokwi/ina219-current',
    chips: ['ina219'],
  },
  {
    id: chipConformanceFixture.id,
    sketch: chipConformanceFixture.sketch,
    projectDir: chipConformanceFixture.projectDir,
    chips: chipConformanceFixture.chips,
  },
]

for (const project of projects) {
  const sketchPath = stageSketch(project.id, project.sketch)
  const outputDir = join(toolsDir, '..', 'wokwi', project.id)

  rmSync(outputDir, { recursive: true, force: true })
  mkdirSync(outputDir, { recursive: true })

  const result = spawnSync(
    arduinoCliBin,
    ['compile', '--fqbn', 'arduino:avr:uno', '--output-dir', outputDir, sketchPath],
    { env: arduinoEnv(), encoding: 'utf-8', stdio: 'inherit' },
  )

  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)

  console.log(`Wokwi firmware written to ${outputDir}`)

  // A project with its own directory keeps every wokwi.toml path local, so the
  // built firmware and the chip binaries are copied in beside it.
  if (!project.projectDir) continue
  const projectRoot = resolve(project.projectDir)
  mkdirSync(projectRoot, { recursive: true })

  copyFileSync(join(outputDir, `${project.id}.ino.hex`), join(projectRoot, 'firmware.hex'))
  copyFileSync(join(outputDir, `${project.id}.ino.elf`), join(projectRoot, 'firmware.elf'))
  // Both halves of a custom chip are required: wokwi.toml names the .wasm, and
  // wokwi-cli looks for the matching .chip.json (pin/control declarations)
  // beside it in the same directory.
  for (const chip of project.chips ?? []) {
    for (const extension of ['wasm', 'json']) {
      copyFileSync(
        resolve('chips', `${chip}.chip.${extension}`),
        join(projectRoot, `${chip}.chip.${extension}`),
      )
    }
  }
  console.log(`Wokwi project assets staged in ${project.projectDir}`)
}
