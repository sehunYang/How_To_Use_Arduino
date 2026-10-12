/**
 * Runs the recipes in src/verification/sketchHostSpecs.ts: compiles each
 * unmodified sketch against logic/host/arduino_host.h, runs it on a virtual
 * clock with the spec's inputs, and judges the serial log with the same checker
 * as the Wokwi runs. No Wokwi time is used.
 *
 * The compiler is `zig c++` from scripts/setup-zig.mjs; SKETCH_HOST_CXX
 * overrides it (e.g. `clang++` where that zig's libc++ does not build).
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { phase5Recipes } from '@/data/phase5'
import { phase6Recipes } from '@/data/phase6'
import { phase7Recipes } from '@/data/phase7'
import { checkSerialBehavior } from '@/wokwi/serialBehavior'
import { parseTrace, type SketchHostSpec } from '@/verification/sketchHost'
import { sketchHostSpecs } from '@/verification/sketchHostSpecs'

const buildDir = resolve('node_modules/.cache/sketch-host')
const header = resolve('logic/host/arduino_host.h')
const recipes = new Map([...phase5Recipes, ...phase6Recipes, ...phase7Recipes].map((recipe) => [recipe.id, recipe]))

async function compiler(): Promise<string[]> {
  if (process.env.SKETCH_HOST_CXX) return [process.env.SKETCH_HOST_CXX]
  const { setupZig } = await import('./setup-zig.mjs')
  return [await setupZig(), 'c++']
}

function sketchFor(spec: SketchHostSpec): string {
  let sketch = recipes.get(spec.recipeId)?.sketch
  if (!sketch) throw new Error(`${spec.recipeId}: recipe not found`)
  for (const { from, to } of spec.sketchEdits ?? []) {
    if (sketch.split(from).length !== 2) throw new Error(`${spec.recipeId}: "${from}" must appear exactly once`)
    sketch = sketch.replace(from, to)
  }
  return sketch
}

function run(spec: SketchHostSpec, cxx: string[], index: number): string[] {
  const name = `${spec.recipeId}-${index}`
  const source = resolve(buildDir, `${name}.cpp`)
  const exe = resolve(buildDir, name)
  writeFileSync(source, `#include "${header}"\n#line 1 "${spec.recipeId}.ino"\n${sketchFor(spec)}\n`)
  const [command, ...prefix] = cxx
  const build = spawnSync(command, [...prefix, '-std=c++17', '-O1', '-o', exe, source], { encoding: 'utf8' })
  if (build.status !== 0) return [`compile failed:\n${build.stderr}`]
  const args = [String(spec.endMs), ...spec.inputs, ...(spec.trace ?? []).map((pin) => `trace=D${pin}`)]
  const result = spawnSync(exe, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (result.status !== 0) return [`exited with ${result.status}: ${result.stderr.slice(0, 500)}`]
  const serial = checkSerialBehavior(spec.behavior, result.stdout)
  return [...serial.failures, ...(spec.checkTrace?.(parseTrace(result.stderr)) ?? [])]
}

mkdirSync(buildDir, { recursive: true })
const cxx = await compiler()
console.log(`Sketch host compiler: ${execFileSync(cxx[0], [...cxx.slice(1), '--version'], { encoding: 'utf8' }).split('\n')[0]}`)
let failed = 0
sketchHostSpecs.forEach((spec, index) => {
  const label = spec.name ? `${spec.recipeId} (${spec.name})` : spec.recipeId
  const failures = run(spec, cxx, index)
  if (failures.length === 0) {
    console.log(`  ok    ${label}: ${spec.endMs / 1000} s simulated`)
    return
  }
  failed++
  console.log(`  FAIL  ${label}`)
  for (const failure of failures.slice(0, 12)) console.log(`        ${failure}`)
})
console.log(`Sketch host runs: ${sketchHostSpecs.length - failed}/${sketchHostSpecs.length} passing`)
process.exit(failed === 0 ? 0 : 1)
