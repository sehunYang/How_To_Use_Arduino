#!/usr/bin/env tsx
/**
 * CI gate for A1.1 / PL8 (holdout set). Run with:
 *   npm run verify:holdout -- --min 73
 * Reads test-data/search-sentences.json's `split: "holdout"` entries only,
 * and — critically — NEVER feeds a failure here back into tuning (scoring
 * weights, the synonym dictionary, or the sentences themselves). Intended
 * to run once, right before release, per the plan's anti-overfitting design.
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

const DEFAULT_MIN = 73
const min = parseMinArg(process.argv.slice(2), DEFAULT_MIN)

const allCases: SentenceCase[] = JSON.parse(readFileSync('test-data/search-sentences.json', 'utf-8'))
const holdout = allCases.filter((c) => c.split === 'holdout')

const studentSourced = holdout.filter((c) => c.source === 'student').length
if (studentSourced === 0) {
  console.warn(
    '⚠️  홀드아웃 15개 전부 source:"author"입니다. PL8은 최소 15개(전체 기준)를 실제 학생 문장으로 요구합니다. ' +
      'test-data/README.md의 TODO를 참고해 출시 전 반드시 교체하세요.',
  )
}

const index = buildTestIndex()
const report = runMatchReport(holdout, index, synonyms)
const percent = Math.round(report.rate * 1000) / 10

console.log(`매칭률(홀드아웃): ${report.passed}/${report.total} (${percent}%)`)
if (report.failures.length > 0) {
  console.log('실패한 문장 (튜닝에 사용하지 마세요):')
  for (const f of report.failures) {
    console.log(`  - "${f.sentence}" (기대: ${f.expectedRecipeId}, 상위3: ${f.gotTopIds.join(', ') || '없음'})`)
  }
}

if (percent < min) {
  console.error(`FAIL: ${percent}% < 임계치 ${min}%`)
  process.exit(1)
}
console.log(`PASS: ${percent}% >= 임계치 ${min}%`)
