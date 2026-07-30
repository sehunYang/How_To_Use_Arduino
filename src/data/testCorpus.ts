import type { SearchIndexEntry } from '@/schema'
import { pendulumRecipe } from './canary'
import { phase5Recipes } from './phase5'
import { buildIndexEntry } from '@/search'

/**
 * Search-gate corpus built from the real Phase 5 authored recipes. Draft
 * status is projected to published only inside this pure test fixture so the
 * matching gate can exercise future release content without exposing it to
 * students before the required human reviews.
 */
export function buildTestIndex(): SearchIndexEntry[] {
  const recipes = [
    pendulumRecipe,
    ...phase5Recipes.filter((recipe) => recipe.id !== pendulumRecipe.id),
  ]
  return recipes.flatMap((recipe) => {
    const entry = buildIndexEntry({ ...recipe, status: 'published' })
    return entry ? [entry] : []
  })
}
