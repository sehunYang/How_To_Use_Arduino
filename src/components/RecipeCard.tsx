import { Link } from 'react-router-dom'
import { inquiryQuestion } from '@/data/inquiry/question'
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

/**
 * 카드 한 장이 이 레시피를 무엇으로 알리는가.
 *
 * 이 탐구가 답하려는 질문이 있으면 그것을 씁니다. 질문은 111개가 모두 다르고
 * 무엇을 하는 탐구인지 한 줄로 알려 줍니다. 예전에 쓰던 응용 안내는 Phase 6의
 * 41개가 글자까지 같아, 갤러리에서 물리 레시피 41장이 똑같은 문단을 달고
 * 늘어섰습니다. 질문이 없는 옛 색인은 예전처럼 응용 안내로 물러섭니다.
 */
function guideFor(recipe: CardRecipe) {
  const question = 'applicationGuide' in recipe ? inquiryQuestion(recipe.body) : recipe.question
  if (question) return question
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
        <span>
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
      {fuzzy && <p className="mt-3 text-caption text-warning">비슷한 탐구</p>}
      {/* 화면 낭독기는 링크만 모아 훑을 수 있습니다. 모두 "레시피 보기 →"라고만 적혀 있으면
          그 목록이 똑같은 줄의 나열이 되어 어느 레시피로 가는 링크인지 가릴 수 없습니다. */}
      <Link
        className="mt-auto pt-5 font-medium text-accent underline-offset-4 hover:underline"
        to={`/recipes/${recipe.id}`}
        aria-label={`${recipe.title} 레시피 보기`}
      >
        레시피 보기 →
      </Link>
    </article>
  )
}
