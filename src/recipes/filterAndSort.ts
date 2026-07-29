import type {
  Difficulty,
  SearchIndexEntry,
  Subject,
} from '@/schema'

export interface RecipeFilters {
  subject?: Subject
  difficulty?: Difficulty
  sensor?: string
}

export type RecipeSort =
  | 'relevance'
  | 'title'
  | 'minutes-asc'
  | 'difficulty-asc'

const difficultyOrder: Record<Difficulty, number> = {
  초급: 0,
  중급: 1,
  고급: 2,
}

export function filterAndSortRecipes(
  recipes: readonly SearchIndexEntry[],
  filters: RecipeFilters = {},
  sort: RecipeSort = 'relevance',
): SearchIndexEntry[] {
  const filtered = recipes.filter(
    (recipe) =>
      (!filters.subject || recipe.subject === filters.subject) &&
      (!filters.difficulty || recipe.difficulty === filters.difficulty) &&
      (!filters.sensor || recipe.sensors.includes(filters.sensor)),
  )

  if (sort === 'relevance') return filtered

  return filtered.toSorted((left, right) => {
    if (sort === 'title') return left.title.localeCompare(right.title, 'ko')
    if (sort === 'minutes-asc') return left.minutes - right.minutes
    return difficultyOrder[left.difficulty] - difficultyOrder[right.difficulty]
  })
}
