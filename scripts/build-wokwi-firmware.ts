#!/usr/bin/env tsx
import { mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { pendulumRecipe } from '../src/data/canary'
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

const sketchPath = stageSketch(pendulumRecipe.id, pendulumRecipe.sketch)
const outputDir = join(toolsDir, '..', 'wokwi', pendulumRecipe.id)

rmSync(outputDir, { recursive: true, force: true })
mkdirSync(outputDir, { recursive: true })

const result = spawnSync(
  arduinoCliBin,
  [
    'compile',
    '--fqbn',
    'arduino:avr:uno',
    '--output-dir',
    outputDir,
    sketchPath,
  ],
  {
    env: arduinoEnv(),
    encoding: 'utf-8',
    stdio: 'inherit',
  },
)

if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)

console.log(`Wokwi firmware written to ${outputDir}`)
