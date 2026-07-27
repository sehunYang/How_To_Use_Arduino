import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runMatchReport, type SentenceCase } from './verifyMatching'
import { buildTestIndex } from '@/data/testCorpus'
import { synonyms } from '@/data/synonyms'

const sentencesPath = fileURLToPath(new URL('../../test-data/search-sentences.json', import.meta.url))
const allCases: SentenceCase[] = JSON.parse(readFileSync(sentencesPath, 'utf-8'))

describe('search-sentences.json shape', () => {
  it('has 45 entries: 30 tuning + 15 holdout', () => {
    expect(allCases).toHaveLength(45)
    expect(allCases.filter((c) => c.split === 'tuning')).toHaveLength(30)
    expect(allCases.filter((c) => c.split === 'holdout')).toHaveLength(15)
  })

  it('every entry references a recipe id that exists in the test corpus', () => {
    const index = buildTestIndex()
    const validIds = new Set(index.map((e) => e.id))
    for (const c of allCases) {
      expect(validIds.has(c.expectedRecipeId), `unknown id "${c.expectedRecipeId}" in "${c.sentence}"`).toBe(true)
    }
  })
})

describe('runMatchReport', () => {
  const index = buildTestIndex()

  it('reports the tuning-set match rate against the stub corpus', () => {
    const tuning = allCases.filter((c) => c.split === 'tuning')
    const report = runMatchReport(tuning, index, synonyms)
    expect(report.total).toBe(30)
    // Not asserting a hard threshold here — that's what the `verify:matching`
    // CLI gate is for. This test only proves the reporting mechanism works
    // and surfaces the current rate for visibility.
    expect(report.rate).toBeGreaterThan(0)
    expect(report.passed + report.failures.length).toBe(report.total)
  })

  it('reports the holdout-set match rate independently of tuning', () => {
    const holdout = allCases.filter((c) => c.split === 'holdout')
    const report = runMatchReport(holdout, index, synonyms)
    expect(report.total).toBe(15)
    expect(report.passed + report.failures.length).toBe(report.total)
  })

  it('a perfectly-matchable case set reports 100%', () => {
    const trivial: SentenceCase[] = [
      { sentence: '진자', expectedRecipeId: 'pendulum', source: 'author', split: 'tuning' },
    ]
    const report = runMatchReport(trivial, index, synonyms)
    expect(report.rate).toBe(1)
    expect(report.failures).toHaveLength(0)
  })

  it('an unmatchable expectation reports the failure with the actual top-3 ids', () => {
    const impossible: SentenceCase[] = [
      { sentence: '진자', expectedRecipeId: 'does-not-exist', source: 'author', split: 'tuning' },
    ]
    const report = runMatchReport(impossible, index, synonyms)
    expect(report.rate).toBe(0)
    expect(report.failures).toHaveLength(1)
    expect(report.failures[0].expectedRecipeId).toBe('does-not-exist')
    expect(report.failures[0].gotTopIds.length).toBeGreaterThan(0)
  })
})
