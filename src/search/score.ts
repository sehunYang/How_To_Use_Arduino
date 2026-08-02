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
const PARTIAL_WEIGHT = 2
const SYNONYM_WEIGHT = 2

/**
 * Terms shorter than this never participate in substring matching — a single
 * Hangul syllable ("추", "열") appears inside far too many unrelated words.
 */
const MIN_TERM_LENGTH = 2

/**
 * Trailing particles stripped from query tokens, longest first so "으로"
 * wins over "로". Verb endings ("-하고", "-어요") are deliberately absent:
 * stripping them would turn every "측정하고 싶어요" into a match for any
 * keyword containing "측정".
 */
const TRAILING_PARTICLES = [
  '에서', '에게', '으로', '처럼', '까지', '부터', '마다',
  '의', '을', '를', '이', '가', '은', '는', '에', '와', '과', '로', '도', '만',
]

/**
 * Whitespace tokens plus their particle-stripped stems ("진자의" → "진자").
 * Both forms are kept: stripping is a guess, and a wrong strip ("길이" → "길")
 * is discarded by the MIN_TERM_LENGTH guard rather than replacing the token.
 */
export function queryStems(query: string): string[] {
  const stems = new Set<string>()
  for (const token of query.split(/\s+/)) {
    if (token.length >= MIN_TERM_LENGTH) stems.add(token)
    for (const particle of TRAILING_PARTICLES) {
      if (token.length > particle.length && token.endsWith(particle)) {
        const stem = token.slice(0, -particle.length)
        if (stem.length >= MIN_TERM_LENGTH) stems.add(stem)
        break
      }
    }
  }
  return [...stems]
}

/**
 * A keyword inherits every dictionary entry it belongs to, treating each
 * entry as a symmetric equivalence group rather than a one-way mapping:
 * - "단진자" ⊇ core term "진자" pulls in 진자's variants (추, 시계추, 흔들),
 *   so an entry keyed "진자" is not dead weight for a corpus whose recipes
 *   only ever list the more specific "단진자" as a core keyword.
 * - "조도" appears as a *variant* under 빛, so a query saying "밝기" (a
 *   sibling variant) still reaches recipes keyed "조도".
 */
function variantsForKeyword(keyword: string, synonyms: SynonymMap): string[] {
  const variants = new Set(synonyms[keyword] ?? [])
  for (const [coreTerm, list] of Object.entries(synonyms)) {
    if (coreTerm === keyword) continue
    const containsCore = coreTerm.length >= MIN_TERM_LENGTH && keyword.includes(coreTerm)
    const containsVariant = list.some(
      (variant) => variant.length >= MIN_TERM_LENGTH && keyword.includes(variant),
    )
    if (containsCore || containsVariant) {
      variants.add(coreTerm)
      for (const variant of list) variants.add(variant)
    }
  }
  variants.delete(keyword)
  return [...variants].filter((variant) => variant.length >= MIN_TERM_LENGTH)
}

/**
 * Substring inclusion (not tokenization) deliberately sidesteps Korean
 * particle/conjugation matching problems — "진자가"/"진자를"/"진자는" all
 * contain the core term "진자" as a substring (spec Round 16 decision).
 *
 * Matching runs in both directions: `query ⊇ keyword` for queries longer
 * than the keyword, and `keyword ⊇ query-stem` for queries more general
 * than the keyword ("진자" must find recipes keyed "단진자").
 */
export function scoreRecipe(
  query: string,
  recipe: { id: string; coreKeywords: string[] },
  synonyms: SynonymMap,
  stems: string[] = queryStems(query),
): ScoredMatch {
  let score = 0
  const matched: string[] = []

  for (const keyword of recipe.coreKeywords) {
    if (query.includes(keyword)) {
      score += CORE_KEYWORD_WEIGHT
      matched.push(keyword)
      continue
    }
    if (stems.some((stem) => keyword.includes(stem))) {
      score += PARTIAL_WEIGHT
      matched.push(keyword)
      continue
    }
    const variants = variantsForKeyword(keyword, synonyms)
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
  const stems = queryStems(query)
  return recipes
    .map((recipe) => scoreRecipe(query, recipe, synonyms, stems))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
}
