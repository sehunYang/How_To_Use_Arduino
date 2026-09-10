import { partsFor } from '@/recipes/parts'
import { useRecipeContext } from './RecipeContext'
import { PartsGroup } from './shared'

export function PartsPage() {
  const { recipe } = useRecipeContext()
  const parts = partsFor(recipe)

  return (
    <div className="max-w-3xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <PartsGroup title="어떤 레시피든 필요한 것" lines={parts.always} />
        <PartsGroup title="이 레시피에서 쓰는 부품" lines={parts.specific} />
        <PartsGroup title="점퍼선" lines={parts.wires} note="양쪽이 뾰족한 것이 수-수(MM), 한쪽이 구멍인 것이 수-암(MF)입니다." />
      </div>
    </div>
  )
}
