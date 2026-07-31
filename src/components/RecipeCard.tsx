import { Link } from 'react-router-dom'
import type { Recipe, SearchIndexEntry } from '@/schema'

type CardRecipe = Recipe | SearchIndexEntry

const SUBJECT_COLOR = {
  '물리': 'text-subject-physics',
  '화학·환경': 'text-subject-chemistry',
  '생물': 'text-subject-biology',
  '공학·로봇': 'text-subject-engineering',
  '융합': 'text-subject-integrated',
} as const

const DIFFICULTY_COLOR = {
  '초급': 'text-difficulty-beginner',
  '중급': 'text-difficulty-intermediate',
  '고급': 'text-difficulty-advanced',
} as const

function timeColor(minutes: number) {
  if (minutes <= 30) return 'text-time-short'
  if (minutes <= 60) return 'text-time-medium'
  return 'text-time-long'
}

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
    <article className="flex h-full flex-col rounded-card border border-border bg-background p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-caption font-semibold">
        <span>
          <span className="text-muted">과목 · </span>
          <span className={SUBJECT_COLOR[recipe.subject ?? '융합']}>{recipe.subject ?? '융합'}</span>
        </span>
        <span>
          <span className="text-muted">난이도 · </span>
          <span className={DIFFICULTY_COLOR[recipe.difficulty]}>{recipe.difficulty}</span>
        </span>
        <span title="30분 이하 짧음 · 31~60분 보통 · 61분 이상 김">
          <span className="text-muted">시간 · </span>
          <span className={timeColor(recipe.minutes)}>{recipe.minutes}분</span>
        </span>
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
    </article>
  )
}
