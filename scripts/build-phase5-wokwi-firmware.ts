#!/usr/bin/env tsx
import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import manifest from '../wokwi/phase5/manifest.json'
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

for (const project of manifest.projects) {
  console.log(`Building Phase 5 Wokwi firmware: ${project.id}`)
  const projectRoot = resolve(project.path)
  const outputDir = resolve('.tools', 'wokwi', 'phase5', project.id)
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

console.log(`Built and staged firmware for ${manifest.projects.length} Phase 5 Wokwi projects.`)
