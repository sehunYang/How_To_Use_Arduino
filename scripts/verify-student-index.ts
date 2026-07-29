#!/usr/bin/env tsx
import { readFile } from 'node:fs/promises'
import { buildIndex } from '../src/search/buildIndexEntry'
import { studentRecipes } from '../src/data/studentCatalog'

const expected = `${JSON.stringify(buildIndex(studentRecipes), null, 2)}\n`
const actual = await readFile('public/index.json', 'utf8')

if (actual !== expected) {
  console.error('FAIL: public/index.json differs from the published recipe source.')
  console.error('Run `tsx scripts/generate-student-index.ts` and commit the result.')
  process.exit(1)
}

console.log(`PASS: public/index.json is current (${buildIndex(studentRecipes).length} published recipes).`)
