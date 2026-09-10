/**
 * 레시피 한 편이 갈라지는 다섯 단계.
 *
 * 예전에는 다섯 절이 한 주소 아래 한 화면에 이어 붙어 있었습니다. 배선 7~36단계,
 * 스케치 50~182줄, 가이드 4,000자가 한 스크롤에 있어서, 지금 무엇을 할 차례인지가
 * 화면 어디에도 없었습니다. 단계마다 주소를 주면 화면에는 한 가지 일만 남고,
 * 뒤로 가기와 새로 고침이 자리를 잃지 않습니다.
 *
 * 순서는 학생이 실제로 손을 대는 순서입니다. 강제하지는 않습니다. 아이디어만
 * 보러 온 학생은 허브에서 바로 4번으로 갈 수 있어야 합니다.
 */
export interface RecipeStep {
  /** `/recipes/:id/` 뒤에 붙는 조각. 허브는 빈 문자열입니다. */
  path: string
  /** 단계 번호. 허브에는 번호가 없습니다. */
  number: number | null
  /** 이동 줄에 적는 짧은 이름. */
  label: string
  /** 그 단계 화면의 제목. */
  title: string
}

export const RECIPE_STEPS: RecipeStep[] = [
  { path: '', number: null, label: '한눈에 보기', title: '한눈에 보기' },
  { path: 'parts', number: 1, label: '준비물', title: '준비물 챙기기' },
  { path: 'wiring', number: 2, label: '배선', title: '배선하기' },
  { path: 'code', number: 3, label: '코드', title: '코드 넣기' },
  { path: 'design', number: 4, label: '탐구 설계', title: '탐구 설계' },
  { path: 'measure', number: 5, label: '측정과 분석', title: '측정과 분석' },
]

/** 화면 제목에 붙는 이름. 번호가 있으면 `2. 배선하기`처럼 적습니다. */
export function stepHeading(step: RecipeStep): string {
  return step.number === null ? step.title : `${step.number}. ${step.title}`
}

/** 레시피 안에서 그 단계로 가는 주소. */
export function stepPath(recipeId: string, step: RecipeStep): string {
  return step.path ? `/recipes/${recipeId}/${step.path}` : `/recipes/${recipeId}`
}

/** 주소의 마지막 조각으로 지금 단계를 찾습니다. 모르는 조각이면 허브로 봅니다. */
export function stepByPath(path: string | undefined): RecipeStep {
  return RECIPE_STEPS.find((step) => step.path === (path ?? '')) ?? RECIPE_STEPS[0]
}
