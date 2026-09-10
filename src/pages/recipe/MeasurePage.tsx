import { Link } from 'react-router-dom'
import { SafeMarkdown } from '@/components/ui/SafeMarkdown'
import { splitGuide } from '@/data/inquiryGuide'
import { linkRecipeTitles } from '@/recipes/relatedRecipes'
import { useRecipeContext } from './RecipeContext'

/**
 * 재고 나서 하는 것.
 *
 * 시리얼 모니터에 값이 쌓인 상태로 오는 화면입니다. 그래서 그 값을 꺼내는 방법이
 * 맨 위에 옵니다. 읽는 법과 그래프와 점검은 꺼낸 다음에 하는 일이라 그 아래에
 * 둡니다.
 */
export function MeasurePage() {
  const { recipe, catalog } = useRecipeContext()
  const guide = splitGuide(recipe.body)

  return (
    <div className="max-w-3xl">
      <section aria-labelledby="export-title" className="rounded-card border border-border p-5">
        <h3 id="export-title" className="font-semibold">측정값 내보내기</h3>
        <p className="mt-3">시리얼 모니터에 쌓인 글을 <strong>열 이름이 적힌 첫 줄부터 끝까지</strong> 끌어서 복사한 뒤, 데이터 화면에 붙여 넣으세요.</p>
        <Link className="mt-4 inline-block text-accent hover:underline" to="/data-analysis">데이터 변환·분석 화면 열기 →</Link>
      </section>

      {guide.measure && (
        <div className="prose mt-8">
          <SafeMarkdown source={linkRecipeTitles(guide.measure, catalog, recipe.id)} checklistScope={`guide:${recipe.id}`} />
        </div>
      )}
    </div>
  )
}
