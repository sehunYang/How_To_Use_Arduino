#!/usr/bin/env node
// L5 logic harness — compiles and runs every *.test.cpp under logic/ and chips/ on the host.
//
// Phase 2 canary subset: 3 recipes (two L3-capable, plus multi-tsl2591) and the 2 chip
// register-logic models (INA219, TSL2591). This is deliberately
// the same runner that Phase 5 scales to 34/34 once the remaining recipes land, so the
// pattern is proven at canary scale before it is depended on at full scale.
//
// Host compiler is `zig c++` (clang) fetched into node_modules/.zig by scripts/setup-zig.mjs
// — nothing is installed system-wide. These tests run on the dev machine, not on hardware.

import * as fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { setupZig } from './setup-zig.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEST_DIRS = ['logic', 'chips']
const buildDir = path.join(repoRoot, 'node_modules', '.cache', 'logic-tests')

async function findTests() {
  const found = []
  for (const dir of TEST_DIRS) {
    const abs = path.join(repoRoot, dir)
    let entries
    try {
      entries = await fs.readdir(abs)
    } catch {
      continue
    }
    for (const e of entries.sort()) {
      if (e.endsWith('.test.cpp')) found.push(path.join(abs, e))
    }
  }
  return found
}

const zig = await setupZig()
const tests = await findTests()

if (tests.length === 0) {
  console.error('No *.test.cpp files found in: ' + TEST_DIRS.join(', '))
  process.exit(1)
}

await fs.mkdir(buildDir, { recursive: true })

let passed = 0
const failures = []

for (const testFile of tests) {
  const name = path.basename(testFile, '.test.cpp')
  const rel = path.relative(repoRoot, testFile).replace(/\\/g, '/')
  const exe = path.join(buildDir, process.platform === 'win32' ? `${name}.exe` : name)

  console.log(`\n=== ${rel} ===`)

  // logic/ is header-only, but chips/ splits declarations from a portable C
  // implementation. Compile that <name>.c as C11 in its own step — one driver
  // invocation cannot take -std=c++17 and a C input — then link the object in.
  const sources = [testFile]
  const impl = testFile.replace(/\.test\.cpp$/, '.c')
  if (existsSync(impl)) {
    const obj = path.join(buildDir, `${name}.o`)
    const buildC = spawnSync(zig, ['cc', '-std=c11', '-c', impl, '-o', obj], {
      stdio: 'inherit',
      cwd: repoRoot,
    })
    if (buildC.status !== 0) {
      failures.push(`${rel}: C implementation failed to compile (exit ${buildC.status})`)
      continue
    }
    sources.push(obj)
  }

  const build = spawnSync(zig, ['c++', '-std=c++17', '-o', exe, ...sources], {
    stdio: 'inherit',
    cwd: repoRoot,
  })
  if (build.status !== 0) {
    failures.push(`${rel}: compile failed (exit ${build.status})`)
    continue
  }

  const run = spawnSync(exe, [], { stdio: 'inherit', cwd: repoRoot })
  if (run.status !== 0) {
    failures.push(`${rel}: tests failed (exit ${run.status})`)
    continue
  }
  passed++
}

console.log(`\nL5 logic harness: ${passed}/${tests.length} passing`)
for (const f of failures) console.error(`  FAIL ${f}`)

process.exit(failures.length === 0 ? 0 : 1)
