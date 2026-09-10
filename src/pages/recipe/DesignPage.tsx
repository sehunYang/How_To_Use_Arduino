import { SafeMarkdown } from '@/components/ui/SafeMarkdown'
import { splitGuide } from '@/data/inquiryGuide'
import { linkRecipeTitles } from '@/recipes/relatedRecipes'
import { useRecipeContext } from './RecipeContext'

/**
 * 재기 전에 정하는 것.
 *
 * 이론, 무엇을 바꾸고 무엇을 재는지, 어떤 순서로 할지, 몇 번 반복할지까지입니다.
 * 재고 나서 하는 일(측정값 읽기·그래프·점검)은 다음 단계에 있습니다. 한 덩어리로
 * 두었을 때에는 한 번도 재보기 전에 '데이터 처리와 그래프'를 읽었습니다.
 */
export function DesignPage() {
  const { recipe, catalog } = useRecipeContext()
  const guide = splitGuide(recipe.body)

  if (!guide.design) {
    return <p className="max-w-3xl text-muted">이 레시피에는 아직 탐구 설계가 붙어 있지 않습니다.</p>
  }

  return (
    <div className="prose max-w-3xl">
      <SafeMarkdown source={linkRecipeTitles(guide.design, catalog, recipe.id)} checklistScope={`guide:${recipe.id}`} />
    </div>
  )
}
