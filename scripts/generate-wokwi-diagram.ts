#!/usr/bin/env tsx
/**
 * Generates every Wokwi diagram.json from its validated ReadableLayout source.
 *
 *   npm run generate:wokwi-diagram    # write
 *   npm run verify:wokwi-diagram      # --check, CI gate
 *
 * `compileReadableLayout()` refuses to emit a diagram whose layout fails strict
 * geometric validation, so a stale or unroutable layout can never reach a
 * generated file. The electrical half of that guarantee lives in netlist.ts and
 * is asserted by src/wokwi/netlist.test.ts.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { compileReadableLayout } from '../src/wokwi/readableLayout'
import type { ReadableLayout } from '../src/wokwi/readableLayout'
import { pendulumLayout } from '../src/wokwi/layouts/pendulumLayout'
import { chipConformanceLayout } from '../src/wokwi/layouts/chipConformanceLayout'

const targets: { layout: ReadableLayout; path: string }[] = [
  { layout: pendulumLayout, path: 'diagram.json' },
  { layout: chipConformanceLayout, path: 'wokwi/chip-conformance/diagram.json' },
]

const check = process.argv.includes('--check')
let stale = false

for (const target of targets) {
  const absolute = resolve(target.path)
  const output = `${JSON.stringify(compileReadableLayout(target.layout), null, 2)}\n`

  if (check) {
    const current = await readFile(absolute, 'utf8').catch(() => null)
    if (current !== output) {
      console.error(`${target.path} is stale. Run: npm run generate:wokwi-diagram`)
      stale = true
    } else {
      console.log(`${target.path} matches its validated ReadableLayout source.`)
    }
    continue
  }

  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, output, 'utf8')
  console.log(`Generated ${target.path} from validated ReadableLayout.`)
}

if (stale) process.exit(1)
