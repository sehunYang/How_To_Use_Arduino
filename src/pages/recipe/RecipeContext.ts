import { createContext, useContext } from 'react'
import type { useWiringSteps } from '@/hooks/useWiringSteps'
import type { RecipeLink } from '@/recipes/relatedRecipes'
import type { Recipe } from '@/schema'

/**
 * 단계 화면들이 함께 보는 것.
 *
 * 레시피를 내려받는 일과 배선 진행 상태는 단계마다 따로 두면 안 됩니다. 코드
 * 화면으로 옮길 때마다 다시 받으면 느리고, 배선 진행이 화면을 옮길 때마다
 * 처음으로 돌아가면 단계를 나눈 뜻이 없어집니다. 껍데기가 한 벌만 들고 있다가
 * 자식 화면에 내려 줍니다.
 */
export interface RecipeContextValue {
  recipe: Recipe
  /** 배선 단계 진행. 배선 화면 밖에서도 "어디까지 했나"를 읽습니다. */
  machine: ReturnType<typeof useWiringSteps>
  /** 가이드가 이름으로 가리키는 다음 탐구를 링크로 바꾸는 데 쓰는 목록. */
  catalog: RecipeLink[]
  /** 배선 단계 하나를 눌렀을 때. 진행 저장과 기록 보내기를 함께 합니다. */
  toggleStep: (index: number, checked: boolean) => void
}

const RecipeContext = createContext<RecipeContextValue | null>(null)

export const RecipeContextProvider = RecipeContext.Provider

/** 단계 화면은 껍데기 안에서만 그려지므로, 값이 없으면 그것이 곧 버그입니다. */
export function useRecipeContext(): RecipeContextValue {
  const value = useContext(RecipeContext)
  if (!value) throw new Error('레시피 단계 화면은 RecipeDetailPage 안에서만 그릴 수 있습니다.')
  return value
}
