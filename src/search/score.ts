/**
 * Global synonym dictionary (plan 1.4 / N13): `{ coreTerm: [variant, ...] }`.
 * Kept separate from `Recipe.coreKeywords` so the same synonym set is
 * shared across every recipe instead of duplicated per-document.
 */
export type SynonymMap = Record<string, string[]>

export interface ScoredMatch {
  recipeId: string
  score: number
  /** Core keywords that matched (directly or via a synonym), for A1.4's "matched keyword" display. */
  matchedKeywords: string[]
}

const CORE_KEYWORD_WEIGHT = 3
const SYNONYM_WEIGHT = 2

/**
 * Substring inclusion (not tokenization) deliberately sidesteps Korean
 * particle/conjugation matching problems — "진자가"/"진자를"/"진자는" all
 * contain the core term "진자" as a substring (spec Round 16 decision).
 */
export function scoreRecipe(
  query: string,
  recipe: { id: string; coreKeywords: string[] },
  synonyms: SynonymMap,
): ScoredMatch {
  let score = 0
  const matched: string[] = []

  for (const keyword of recipe.coreKeywords) {
    if (query.includes(keyword)) {
      score += CORE_KEYWORD_WEIGHT
      matched.push(keyword)
      continue
    }
    const variants = synonyms[keyword] ?? []
    if (variants.some((variant) => query.includes(variant))) {
      score += SYNONYM_WEIGHT
      matched.push(keyword)
    }
  }

  return { recipeId: recipe.id, score, matchedKeywords: matched }
}

/** Scores every recipe, returns only non-zero matches, highest score first. */
export function scoreAll<T extends { id: string; coreKeywords: string[] }>(
  query: string,
  recipes: T[],
  synonyms: SynonymMap,
): ScoredMatch[] {
  return recipes
    .map((recipe) => scoreRecipe(query, recipe, synonyms))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
}
