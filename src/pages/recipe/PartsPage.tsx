import { apparatusFor, partsFor } from '@/recipes/parts'
import { useRecipeContext } from './RecipeContext'
import { PartsGroup } from './shared'

export function PartsPage() {
  const { recipe } = useRecipeContext()
  const parts = partsFor(recipe)
  // 배선에 이름이 나오지 않는 준비물은 탐구 설계가 적어 둡니다. 이것이 없으면
  // 진자를 매달 실도 추도 스탠드도 이 화면에 없고, 학생은 탐구 순서까지 읽고
  // 나서야 무엇이 더 필요한지 알게 됩니다.
  const apparatus = apparatusFor(recipe.body).map((name) => ({ name }))

  return (
    <div className="max-w-3xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <PartsGroup title="어떤 레시피든 필요한 것" lines={parts.always} />
        <PartsGroup title="이 레시피에서 쓰는 부품" lines={parts.specific} />
        <PartsGroup title="점퍼선" lines={parts.wires} note="양쪽이 뾰족한 것이 수-수(MM), 한쪽이 구멍인 것이 수-암(MF)입니다." />
        <PartsGroup title="실험 장치" lines={apparatus} note="전자 부품이 아니라 교실이나 집에서 찾아야 하는 것입니다." />
      </div>
    </div>
  )
}
