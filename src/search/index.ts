import Fuse from 'fuse.js'
import type { SearchIndexEntry } from '@/schema'
import { queryStems, scoreAll, type SynonymMap } from './score'

export interface SearchResult {
  entry: SearchIndexEntry
  matchedKeywords: string[]
  via: 'dictionary' | 'fuzzy'
  relevanceScore: number
  sensorEligible: boolean
}

export interface SearchOptions {
  /** Dictionary score at/above which a match is "confident" enough to skip fuzzy fallback. */
  threshold?: number
  /** Minimum results guaranteed for any non-empty index (spec A1.2 — never an empty screen). */
  minResults?: number
}

/**
 * 2, not 3: one solid signal — a partial match ("진자" ⊂ "단진자") or a
 * synonym hit — is enough to call a recipe genuinely relevant. Requiring a
 * full core-keyword hit (3) demoted every partial-only match to the fuzzy
 * fallback, where the UI presents it as "비슷한 탐구" instead of an answer.
 */
const DEFAULT_THRESHOLD = 2
const DEFAULT_MIN_RESULTS = 3

/**
 * Two-stage pipeline (spec A1.1/A1.2, plan 3.5): the synonym-dictionary
 * scorer runs first; if it doesn't produce enough confident matches, Fuse.js
 * fuzzy search over titles + keywords tops up the result set. The `minResults`
 * floor is enforced unconditionally (padding from the raw index as a last
 * resort) so a search screen is never empty when recipes exist.
 */
export function search(
  query: string,
  index: SearchIndexEntry[],
  synonyms: SynonymMap,
  options: SearchOptions = {},
): SearchResult[] {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD
  const minResults = options.minResults ?? DEFAULT_MIN_RESULTS

  const byId = new Map(index.map((entry) => [entry.id, entry]))
  const scored = scoreAll(query, index, synonyms)
  const confident = scored.filter((match) => match.score >= threshold)

  const results: SearchResult[] = confident.map((match) => ({
    entry: byId.get(match.recipeId)!,
    matchedKeywords: match.matchedKeywords,
    via: 'dictionary',
    relevanceScore: match.score,
    sensorEligible: true,
  }))
  const seen = new Set(results.map((r) => r.entry.id))

  if (results.length >= minResults) return results

  const fuse = new Fuse(index, {
    keys: ['title', 'coreKeywords'],
    threshold: 0.4,
    ignoreLocation: true,
    includeScore: true,
  })
  // Fuzzy-search the whole query AND each stem: Fuse's bitap matcher gives
  // up on sentence-length patterns, so "진자 길이에 따라 …" only finds
  // anything when its individual words are searched too. Per entry, the
  // best (lowest) Fuse score across all probes wins.
  const bestFuzzy = new Map<string, { entry: SearchIndexEntry; score: number }>()
  for (const probe of [query, ...queryStems(query)]) {
    for (const hit of fuse.search(probe)) {
      const fuseScore = hit.score ?? 1
      const known = bestFuzzy.get(hit.item.id)
      if (!known || fuseScore < known.score) {
        bestFuzzy.set(hit.item.id, { entry: hit.item, score: fuseScore })
      }
    }
  }
  const fuzzyHits = [...bestFuzzy.values()].sort((a, b) => a.score - b.score)
  for (const hit of fuzzyHits) {
    if (seen.has(hit.entry.id)) continue
    results.push({
      entry: hit.entry,
      matchedKeywords: [],
      via: 'fuzzy',
      relevanceScore: Math.max(0, (1 - hit.score) * DEFAULT_THRESHOLD),
      sensorEligible: true,
    })
    seen.add(hit.entry.id)
    if (results.length >= minResults) return results
  }

  // Still short (e.g. the query matched almost nothing): pad from the raw
  // index so the "never empty" guarantee holds for any non-empty corpus.
  for (const entry of index) {
    if (seen.has(entry.id)) continue
    results.push({
      entry,
      matchedKeywords: [],
      via: 'fuzzy',
      relevanceScore: 0,
      sensorEligible: false,
    })
    seen.add(entry.id)
    if (results.length >= minResults) break
  }

  return results
}

export { scoreAll, scoreRecipe, type SynonymMap, type ScoredMatch } from './score'
export { buildIndexEntry, buildIndex } from './buildIndexEntry'
