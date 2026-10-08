#!/usr/bin/env tsx
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { simulationPhases } from '../src/wokwi/phase5SimulationRegistry'
import {
  arduinoCliBin,
  arduinoEnv,
  isArduinoCliInstalled,
  SETUP_HINT,
} from '../src/verification/arduinoCli'

if (!isArduinoCliInstalled()) {
  console.error(SETUP_HINT)
  process.exit(1)
}

const projects = simulationPhases.flatMap(({ root }) =>
  (JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8')) as {
    projects: Array<{ id: string; path: string; chips: string[] }>
  }).projects)

for (const project of projects) {
  console.log(`Building Phase 5 Wokwi firmware: ${project.id}`)
  const projectRoot = resolve(project.path)
  const outputDir = resolve('.tools', 'wokwi', project.path)
  const sketchPath = resolve(projectRoot, `${project.id}.ino`)

  rmSync(outputDir, { recursive: true, force: true })
  mkdirSync(outputDir, { recursive: true })

  const result = spawnSync(
    arduinoCliBin,
    ['compile', '--fqbn', 'arduino:avr:uno', '--jobs', '0', '--output-dir', outputDir, sketchPath],
    { env: arduinoEnv(), encoding: 'utf-8', stdio: 'inherit', timeout: 120_000 },
  )
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)

  copyFileSync(resolve(outputDir, `${project.id}.ino.hex`), resolve(projectRoot, 'firmware.hex'))
  copyFileSync(resolve(outputDir, `${project.id}.ino.elf`), resolve(projectRoot, 'firmware.elf'))
  for (const chip of project.chips) {
    copyFileSync(resolve('chips', `${chip}.chip.wasm`), resolve(projectRoot, `${chip}.chip.wasm`))
    copyFileSync(resolve('chips', `${chip}.chip.json`), resolve(projectRoot, `${chip}.chip.json`))
  }
}

// Fault variants run the same firmware as their source project on a changed circuit.
const variants = (JSON.parse(readFileSync(resolve('wokwi/variants/manifest.json'), 'utf8')) as {
  variants: Array<{ path: string; sourcePath: string; chips: string[] }>
}).variants
for (const variant of variants) {
  for (const file of ['firmware.hex', 'firmware.elf']) {
    copyFileSync(resolve(variant.sourcePath, file), resolve(variant.path, file))
  }
  for (const chip of variant.chips) {
    copyFileSync(resolve('chips', `${chip}.chip.wasm`), resolve(variant.path, `${chip}.chip.wasm`))
    copyFileSync(resolve('chips', `${chip}.chip.json`), resolve(variant.path, `${chip}.chip.json`))
  }
}

console.log(`Built and staged firmware for ${projects.length} Wokwi projects and ${variants.length} variants.`)
