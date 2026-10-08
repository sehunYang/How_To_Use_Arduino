#!/usr/bin/env tsx
/**
 * Judges the one-time hardware check records (docs/hardware-check.md):
 *   npm run verify:hardware                 # judge whatever has been recorded
 *   npm run verify:hardware -- --require-all  # also fail on missing conditions
 *
 * Exits non-zero if any record fails its datasheet tolerance.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { phase5Recipes } from '../src/data/phase5'
import { phase6Recipes } from '../src/data/phase6'
import { phase7Recipes } from '../src/data/phase7'
import {
  checkHardwareRecord,
  type HardwareRecord,
  parseHardwareRecord,
  REQUIRED_CONDITIONS,
} from '../src/hardware/acceptance'

const RECORDS = resolve('hardware-check/records')
const requireAll = process.argv.includes('--require-all')
// Probe names that differ from the inventory's sensor ids.
const INVENTORY_ID: Record<string, string> = { hall: 'hbe0704', pir: 'hc-sr501' }

const recipes = [...phase5Recipes, ...phase6Recipes, ...phase7Recipes]
let failed = false

for (const sensor of Object.keys(REQUIRED_CONDITIONS)) {
  const inventoryId = INVENTORY_ID[sensor] ?? sensor
  const dependents = recipes.filter((recipe) => recipe.sensors.includes(inventoryId)).length
  const directory = join(RECORDS, sensor)
  const files = existsSync(directory) ? readdirSync(directory).filter((file) => file.endsWith('.csv')) : []
  console.log(`\n${sensor} — ${dependents} recipe(s) depend on it`)

  const records = new Map<string, HardwareRecord>(files.map((file) => {
    const condition = basename(file, '.csv')
    return [condition, parseHardwareRecord(sensor, condition, readFileSync(join(directory, file), 'utf8'))]
  }))
  if (records.size === 0) console.log('  (not recorded yet)')
  for (const [condition, record] of records) {
    for (const result of checkHardwareRecord(record, records)) {
      const mark = result.status === 'pass' ? 'PASS' : result.status === 'warn' ? 'WARN' : 'FAIL'
      console.log(`  ${mark} ${condition} / ${result.name}: ${result.detail}`)
      if (result.status === 'fail') failed = true
    }
  }

  const missing = REQUIRED_CONDITIONS[sensor].filter((condition) =>
    condition.includes('<') ? ![...records.keys()].some((name) => name.startsWith('load-')) : !records.has(condition))
  if (missing.length > 0) {
    console.log(`  missing: ${missing.map((condition) => `${condition}.csv`).join(', ')}`)
    if (requireAll) failed = true
  }
}

if (failed) {
  console.error('\nverify:hardware FAILED')
  process.exit(1)
}
console.log('\nverify:hardware passed.')
