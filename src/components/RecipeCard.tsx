import { Link } from 'react-router-dom'
import { withBasePath } from '@/lib/basePath'
import type { Recipe, SearchIndexEntry } from '@/schema'

type CardRecipe = Recipe | SearchIndexEntry

function guideFor(recipe: CardRecipe) {
  return 'applicationGuide' in recipe ? recipe.applicationGuide : recipe.applicationGuideExcerpt
}

export function RecipeCard({
  recipe,
  matchedKeywords = [],
  fuzzy = false,
}: {
  recipe: CardRecipe
  matchedKeywords?: string[]
  fuzzy?: boolean
}) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-card border border-border bg-background shadow-sm">
      <img
        src={withBasePath(recipe.imageUrl)}
        alt={`${recipe.title} 배선도`}
        className="aspect-[4/3] w-full border-b border-border bg-muted-background object-contain"
        loading="lazy"
        width={400}
        height={300}
      />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap gap-2 text-caption text-muted">
          <span>{recipe.subject ?? '융합'}</span><span>·</span><span>{recipe.difficulty}</span><span>·</span><span>{recipe.minutes}분</span>
        </div>
        <h3 className="text-heading font-semibold">{recipe.title}</h3>
        <p className="mt-2 line-clamp-3 text-body text-muted">{guideFor(recipe)}</p>
        {matchedKeywords.length > 0 && (
          <p className="mt-3 text-caption text-success">
            {matchedKeywords.map((keyword) => `#${keyword}`).join(' ')}와 연결됨
          </p>
        )}
        {fuzzy && <p className="mt-3 text-caption text-warning">정확히 맞는 건 없지만, 이런 탐구는 어때요?</p>}
        <Link className="mt-auto pt-5 font-medium text-accent underline-offset-4 hover:underline" to={`/recipes/${recipe.id}`}>
          레시피 보기 →
        </Link>
      </div>
    </article>
  )
}
