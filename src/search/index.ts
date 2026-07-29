import Fuse from 'fuse.js'
import type { SearchIndexEntry } from '@/schema'
import { scoreAll, type SynonymMap } from './score'

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

const DEFAULT_THRESHOLD = 3
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
  for (const hit of fuse.search(query)) {
    if (seen.has(hit.item.id)) continue
    results.push({
      entry: hit.item,
      matchedKeywords: [],
      via: 'fuzzy',
      relevanceScore: Math.max(0, (1 - (hit.score ?? 1)) * DEFAULT_THRESHOLD),
      sensorEligible: true,
    })
    seen.add(hit.item.id)
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
