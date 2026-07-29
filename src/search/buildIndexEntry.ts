import type { Recipe, SearchIndexEntry } from '@/schema'

const APPLICATION_GUIDE_EXCERPT_LENGTH = 180

function applicationGuideExcerpt(applicationGuide: string): string {
  const normalized = applicationGuide.trim().replace(/\s+/g, ' ')
  if (normalized.length <= APPLICATION_GUIDE_EXCERPT_LENGTH) return normalized
  return `${normalized.slice(0, APPLICATION_GUIDE_EXCERPT_LENGTH - 1).trimEnd()}…`
}

/**
 * Excludes drafts (plan N7) — a draft appearing in the index would be a
 * search result that 404s when opened, since read access is gated on
 * `status === 'published'` (or admin/CI). This is the single function both
 * the authoring UI and the CI consistency checker call, so the two can
 * never disagree (plan 1.4).
 */
export function buildIndexEntry(recipe: Recipe): SearchIndexEntry | null {
  if (recipe.status !== 'published') return null
  return {
    id: recipe.id,
    title: recipe.title,
    subject: recipe.subject,
    difficulty: recipe.difficulty,
    minutes: recipe.minutes,
    sensors: recipe.sensors,
    actuators: recipe.actuators,
    coreKeywords: recipe.coreKeywords,
    imageUrl: recipe.imageUrl,
    applicationGuideExcerpt: applicationGuideExcerpt(recipe.applicationGuide),
  }
}

export function buildIndex(recipes: Recipe[]): SearchIndexEntry[] {
  const entries: SearchIndexEntry[] = []
  for (const recipe of recipes) {
    const entry = buildIndexEntry(recipe)
    if (entry) entries.push(entry)
  }
  return entries
}
