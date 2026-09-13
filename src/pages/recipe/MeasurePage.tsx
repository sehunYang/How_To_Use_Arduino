import { Link } from 'react-router-dom'
import { SafeMarkdown } from '@/components/ui/SafeMarkdown'
import { splitGuide } from '@/data/inquiryGuide'
import { buildAnalysisParams } from '@/lib/serialLiveCheck'
import { linkRecipeTitles } from '@/recipes/relatedRecipes'
import { useRecipeContext } from './RecipeContext'

/**
 * 재고 나서 하는 것.
 *
 * 시리얼 모니터에 값이 쌓인 상태로 오는 화면입니다. 그래서 그 값을 꺼내는 방법이
 * 맨 위에 옵니다. 링크에 레시피의 시리얼 속도를 실어 보내, 데이터 화면에서 속도를
 * 다시 고르지 않아도 되게 합니다. 읽는 법과 그래프와 점검은 꺼낸 다음에 하는 일이라 그 아래에
 * 둡니다.
 */
export function MeasurePage() {
  const { recipe, catalog } = useRecipeContext()
  const guide = splitGuide(recipe.body)

  return (
    <div className="max-w-3xl">
      <section aria-labelledby="export-title" className="rounded-card border border-border p-5">
        <h3 id="export-title" className="font-semibold">측정값 내보내기</h3>
        <p className="mt-3">아두이노를 USB로 꽂은 채 데이터 화면에서 <strong>[USB로 받기]</strong>를 누르면 값이 들어옵니다. 그 전에 IDE의 시리얼 모니터 창은 닫으세요. 포트는 한 프로그램만 쓸 수 있습니다.</p>
        <p className="mt-2 text-caption text-muted">크롬·엣지가 아니거나 USB로 받기가 안 되면, 시리얼 모니터에 쌓인 글을 열 이름이 적힌 첫 줄부터 끝까지 복사해 데이터 화면에 붙여 넣으세요.</p>
        <Link className="mt-4 inline-block text-accent hover:underline" to={`/data-analysis?${buildAnalysisParams(recipe)}`}>데이터 변환·분석 화면 열기 →</Link>
      </section>

      {guide.measure && (
        <div className="prose mt-8">
          <SafeMarkdown source={linkRecipeTitles(guide.measure, catalog, recipe.id)} checklistScope={`guide:${recipe.id}`} />
        </div>
      )}
    </div>
  )
}
