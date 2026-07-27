import type { SearchIndexEntry } from '@/schema'
import { search, type SynonymMap } from './index'

export interface SentenceCase {
  sentence: string
  expectedRecipeId: string
  /** 'author': hand-written placeholder. 'student': collected from a real student. */
  source: 'author' | 'student'
  split: 'tuning' | 'holdout'
}

export interface MatchFailure {
  sentence: string
  expectedRecipeId: string
  gotTopIds: string[]
}

export interface MatchReport {
  total: number
  passed: number
  /** 0.0 - 1.0 */
  rate: number
  failures: MatchFailure[]
}

/**
 * A case "passes" when its expected recipe appears in the top-3 results
 * (spec A1.1: "상위 3위 안에"), not merely first place.
 */
export function runMatchReport(
  cases: SentenceCase[],
  index: SearchIndexEntry[],
  synonyms: SynonymMap,
): MatchReport {
  const failures: MatchFailure[] = []
  let passed = 0

  for (const testCase of cases) {
    const results = search(testCase.sentence, index, synonyms)
    const top3Ids = results.slice(0, 3).map((r) => r.entry.id)
    if (top3Ids.includes(testCase.expectedRecipeId)) {
      passed++
    } else {
      failures.push({
        sentence: testCase.sentence,
        expectedRecipeId: testCase.expectedRecipeId,
        gotTopIds: top3Ids,
      })
    }
  }

  return {
    total: cases.length,
    passed,
    rate: cases.length === 0 ? 0 : passed / cases.length,
    failures,
  }
}
