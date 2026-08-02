import type { Recipe } from '@/schema'

/**
 * 교실에서 이 레시피를 실제로 굴릴 때 필요한 두 가지.
 *
 * 하나는 **시간 감각**입니다. 레시피는 `50분`처럼 전체 시간만 알려 주는데,
 * 수업은 45분에 끊깁니다. 어디까지 하고 끊어야 다음 시간에 처음부터 다시
 * 하지 않는지는 학생이 스스로 판단할 수 없습니다.
 *
 * 다른 하나는 **막혔을 때 물어보는 법**입니다. "안 돼요"라고만 말하면 선생님도
 * 무엇부터 봐야 할지 알 수 없어 처음부터 다시 짚게 됩니다. 지금 화면이 이미
 * 알고 있는 것(레시피, 속도, 어디까지 했는지)을 적어 두면 그만큼을 건너뜁니다.
 */

/** 한 차시 길이. 중·고등학교 수업 시간을 기준으로 삼습니다. */
export const CLASS_MINUTES = 45

export interface LessonStage {
  title: string
  minutes: number
}

export interface LessonPlan {
  /** 45분 수업으로 몇 차시가 필요한지 */
  classes: number
  stages: LessonStage[]
  /** 차시를 나눠야 할 때 어디에서 끊을지 */
  breakAdvice: string
}

/**
 * 단계별 비중. 배선에 가장 많은 시간이 걸리고, 첫 값을 확인하는 데도 생각보다
 * 오래 걸립니다. 이 비율은 실제 수업의 순서(준비 → 배선 → 업로드 → 측정 → 정리)를
 * 그대로 따릅니다.
 */
const STAGE_WEIGHTS: Array<{ title: string; weight: number }> = [
  { title: '준비물 챙기고 배선하기', weight: 0.35 },
  { title: '코드 넣고 첫 값이 정상인지 확인하기', weight: 0.2 },
  { title: '조건을 바꿔 가며 측정하기', weight: 0.35 },
  { title: '측정값 붙여 넣고 그래프까지 확인하기', weight: 0.1 },
]

/** 5분 단위로 끊어 적습니다. 1분 단위 숫자는 지킬 수 없는 약속처럼 읽힙니다. */
function roundToFive(minutes: number): number {
  return Math.max(5, Math.round(minutes / 5) * 5)
}

export function lessonPlan(recipe: Pick<Recipe, 'minutes'>): LessonPlan {
  const classes = Math.max(1, Math.ceil(recipe.minutes / CLASS_MINUTES))
  const stages = STAGE_WEIGHTS.map((stage) => ({
    title: stage.title,
    minutes: roundToFive(recipe.minutes * stage.weight),
  }))

  return {
    classes,
    stages,
    breakAdvice:
      classes === 1
        ? '한 차시에 끝나는 분량입니다. 남는 시간이 생기면 조건을 하나 더 넣어 반복 횟수를 채우세요.'
        : '차시를 나눌 때는 배선을 마친 자리가 아니라 **첫 값이 정상으로 나온 것을 확인한 뒤**에 끊으세요. 배선만 해 두고 끊으면 다음 시간에 어디가 틀렸는지부터 다시 찾아야 합니다.',
  }
}

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
