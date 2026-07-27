#!/usr/bin/env tsx
/**
 * CI gate for A1.1 / PL8 (tuning set). Run with:
 *   npm run verify:matching -- --min 83
 * Reads test-data/search-sentences.json's `split: "tuning"` entries only.
 * See test-data/README.md for the outstanding TODO on real student sentences.
 */
import { readFileSync } from 'node:fs'
import { runMatchReport, type SentenceCase } from '../src/search/verifyMatching'
import { buildTestIndex } from '../src/data/testCorpus'
import { synonyms } from '../src/data/synonyms'

function parseMinArg(argv: string[], fallback: number): number {
  const idx = argv.indexOf('--min')
  if (idx === -1 || !argv[idx + 1]) return fallback
  const value = Number(argv[idx + 1])
  return Number.isFinite(value) ? value : fallback
}

const DEFAULT_MIN = 83
const min = parseMinArg(process.argv.slice(2), DEFAULT_MIN)

const allCases: SentenceCase[] = JSON.parse(readFileSync('test-data/search-sentences.json', 'utf-8'))
const tuning = allCases.filter((c) => c.split === 'tuning')

const index = buildTestIndex()
const report = runMatchReport(tuning, index, synonyms)
const percent = Math.round(report.rate * 1000) / 10

console.log(`매칭률(튜닝셋): ${report.passed}/${report.total} (${percent}%)`)
if (report.failures.length > 0) {
  console.log('실패한 문장:')
  for (const f of report.failures) {
    console.log(`  - "${f.sentence}" (기대: ${f.expectedRecipeId}, 상위3: ${f.gotTopIds.join(', ') || '없음'})`)
  }
}

if (percent < min) {
  console.error(`FAIL: ${percent}% < 임계치 ${min}%`)
  process.exit(1)
}
console.log(`PASS: ${percent}% >= 임계치 ${min}%`)
