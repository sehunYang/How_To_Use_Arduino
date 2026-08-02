import type { Recipe } from '@/schema'

/**
 * 막혔을 때 물어보는 법.
 *
 * "안 돼요"라고만 말하면 선생님도 무엇부터 봐야 할지 알 수 없어 처음부터 다시
 * 짚게 됩니다. 지금 화면이 이미 알고 있는 것(레시피, 속도, 어디까지 했는지)을
 * 적어 두면 그만큼을 건너뜁니다.
 */

export interface HelpCardInput {
  recipe: Pick<Recipe, 'id' | 'title' | 'baudRate' | 'wiring'>
  /** 배선 단계 중 표시한 칸의 수 */
  checkedSteps: number
}

/**
 * 선생님이나 친구에게 그대로 보여 줄 상태 요약. 빈칸은 학생이 채우도록 남깁니다.
 * 화면이 이미 아는 것만 채워 두고, 모르는 것을 지어내지 않습니다.
 */
export function helpCardText({ recipe, checkedSteps }: HelpCardInput): string {
  return [
    '[도와주세요]',
    `레시피: ${recipe.title} (${recipe.id})`,
    `보드: 아두이노 우노 · 시리얼 모니터 속도: ${recipe.baudRate} baud`,
    `배선: ${recipe.wiring.length}단계 중 ${checkedSteps}단계까지 확인함`,
    '',
    '무엇이 안 되나요: ',
    '시리얼 모니터에 나온 줄: ',
    '이미 해 본 것: ',
  ].join('\n')
}
