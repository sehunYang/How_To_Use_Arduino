#!/usr/bin/env tsx
import { performance } from 'node:perf_hooks'
import { readFile } from 'node:fs/promises'
import { buildTestIndex } from '../src/data/testCorpus'
import { synonyms } from '../src/data/synonyms'
import { search } from '../src/search'
import type { SentenceCase } from '../src/search/verifyMatching'

const LIMIT_MS = 1_500
const cases: SentenceCase[] = JSON.parse(await readFile('test-data/search-sentences.json', 'utf8'))
const index = buildTestIndex()
let slowestMs = 0

for (const testCase of cases) {
  const started = performance.now()
  search(testCase.sentence, index, synonyms)
  slowestMs = Math.max(slowestMs, performance.now() - started)
}

console.log(`Search performance: slowest ${slowestMs.toFixed(2)}ms / ${LIMIT_MS}ms (${cases.length} queries)`)
if (slowestMs > LIMIT_MS) {
  console.error(`FAIL: a search exceeded the ${LIMIT_MS}ms response budget.`)
  process.exit(1)
}
console.log('PASS: search response-time budget satisfied.')
