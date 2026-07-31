import type { Recipe } from '@/schema'
import { formatArduinoCode } from '@/lib/formatArduinoCode'

const GUIDE_MARKER = '<!-- inquiry-workbook-v1 -->'

type ExperimentPlan = 'event' | 'time-series' | 'transient' | 'condition-comparison'

function experimentPlan(recipe: Recipe): ExperimentPlan {
  const headline = [recipe.id, recipe.title, recipe.coreKeywords.join(' ')]
    .join(' ')
    .toLowerCase()
  const description = `${headline} ${recipe.body} ${recipe.applicationGuide}`.toLowerCase()

  if (/(interrupt|인터럽트|이벤트|발생 시점|회전수|rpm|유도 신호)/.test(headline)) {
    return 'event'
  }
  if (/(24시간|장시간|시계열|시간에 따른|시간 변화|시간 안정성|이동평균|시간 추세|변화량|온도 구배|열전달 방향)/.test(description)) {
    return 'time-series'
  }
  if (/(에 따른|별 |각도별|관계|분포|법칙|비교|효율)/.test(recipe.title)) {
    return 'condition-comparison'
  }
  if (/(pendulum-period|mechanical-energy|자유낙하|냉각 곡선|충돌|반발계수|회전 감쇠|융해 잠열|충전|방전|시간상수|줄열|발열|흡열|에너지 보존)/.test(headline)) {
    return 'transient'
  }
  return 'condition-comparison'
}

function samplingPlan(recipe: Recipe) {
  const levels = recipe.difficulty === '초급' ? 5 : recipe.difficulty === '중급' ? 6 : 8
  const repeats = 3
  const samples = recipe.difficulty === '초급' ? 20 : 30
  const intervalSeconds = recipe.sensors.some((sensor) => sensor === 'ds18b20' || sensor === 'bme280')
    ? 2
    : 1
  const settlingSeconds = recipe.sensors.includes('ds18b20') ? 60 : recipe.sensors.includes('bme280') ? 30 : 10
  return { levels, repeats, samples, intervalSeconds, settlingSeconds }
}

function latexize(source: string) {
  const replacements: Array<[RegExp, string]> = [
    [/(?<!\$)\bV=IR\b(?!\$)/g, '$V=IR$'],
    [/(?<!\$)\bP=VI=I²R\b(?!\$)/g, '$P=VI=I^2R$'],
    [/(?<!\$)\bP=VI\b(?!\$)/g, '$P=VI$'],
    [/(?<!\$)\bV=E-Ir\b(?!\$)/g, '$V=E-Ir$'],
    [/(?<!\$)\bB≈μ₀nI\b(?!\$)/g, '$B\\approx\\mu_0 nI$'],
    [/(?<!\$)\bF=ma\b(?!\$)/g, '$F=ma$'],
    [/(?<!\$)\bRₑq=ΣR\b(?!\$)/g, '$R_{\\mathrm{eq}}=\\sum R_i$'],
    [/(?<!\$)\b1\/Rₑq=Σ\(1\/R\)(?!\$)/g, '$\\frac{1}{R_{\\mathrm{eq}}}=\\sum_i\\frac{1}{R_i}$'],
  ]
  return replacements.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), source)
}

function firstParagraph(source: string) {
  return source
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/^#+\s+.*$/gm, '').trim())
    .find((paragraph) => paragraph && !paragraph.startsWith(':::')) ?? ''
}

function theoryPrimer(recipe: Recipe, plan: ExperimentPlan) {
  const targetSection = recipe.body.includes('## 변인')
    ? recipe.body.match(/## 탐구 목표\s+([\s\S]*?)(?=\n## |\n:::|$)/)?.[1] ?? ''
    : recipe.body.match(/:::toggle [^\n]*(?:원리|과학|한계)[^\n]*\n([\s\S]*?)\n:::/)?.[1] ?? ''
  const fallback = recipe.body.match(/^## [^\n]+\s+([\s\S]*?)(?=\n## |\n:::|$)/)?.[1] ?? ''
  const explanation = firstParagraph(targetSection) || firstParagraph(fallback)

  const interpretation = plan === 'condition-comparison'
    ? '이 실험에서는 한 번에 한 조건만 바꾸고 측정값이 어느 방향으로 얼마나 달라지는지 비교하면 이 관계를 확인할 수 있습니다.'
    : '이 실험에서는 시간 정보가 포함된 원시 측정값을 먼저 보존하고, 사건 전후 또는 기록 시간 전체의 변화 양상을 나중에 분석해야 이 관계를 확인할 수 있습니다.'
  return `센서는 눈으로 정확히 비교하기 어려운 변화를 전기 신호와 숫자로 바꾸어 보여 주는 도구입니다. ${explanation} ${interpretation}`
}

function eventWorkbook(recipe: Recipe) {
  const repetitions = recipe.difficulty === '초급' ? 10 : 15
  return `## 실험 실행 계획

이 탐구는 조건을 단계별로 바꾸는 실험이 아니라 **사건이 발생한 시점과 센서 응답**을 기록하는 실험입니다.

| 항목 | 권장값 | 실제 사용값 | 확인 |
|:---|---:|---:|:---:|
| 예비 관찰 시간 | 60초 |  | □ |
| 사건 반복 횟수 | ${repetitions}회 |  | □ |
| 사건 사이 최소 간격 | 3초 |  | □ |
| 기록할 시간 정보 | 발생 시각·응답 시각 |  | □ |

1. 60초간 예비 관찰하여 사건이 없을 때의 신호 범위와 오검출 여부를 확인합니다.
2. 사건을 ${repetitions}회 독립적으로 일으키고 각 발생 시각과 센서가 검출한 시각을 빠짐없이 저장합니다.
3. 한 사건의 신호가 끝난 뒤 다음 사건을 일으켜 서로 겹치지 않게 합니다.
4. 저장한 CSV에서 누락률, 오검출률, 응답 지연과 반복 간 차이를 계산합니다.`
}

function timeSeriesWorkbook(recipe: Recipe, intervalSeconds: number) {
  const durationMinutes = recipe.sensors.some((sensor) => sensor === 'ds18b20' || sensor === 'bme280') ? 30 : 10
  return `## 실험 실행 계획

이 탐구는 **끊김 없는 연속 기록**에서 시간에 따른 변화를 찾는 실험입니다.

| 항목 | 권장값 | 실제 사용값 | 확인 |
|:---|---:|---:|:---:|
| 예비 관찰 시간 | 60초 |  | □ |
| 연속 기록 시간 | ${durationMinutes}분 이상 |  | □ |
| 기록 간격 | ${intervalSeconds}초 |  | □ |
| 함께 기록할 환경 정보 | 시작·종료 시각과 관찰 메모 |  | □ |

1. 센서 시각과 실제 시작 시각을 기록하고 60초간 예비 관찰하여 단선과 측정 범위 초과를 확인합니다.
2. ${intervalSeconds}초 간격으로 ${durationMinutes}분 이상 중단 없이 원시 CSV를 저장합니다.
3. 장치를 만지거나 주변 환경이 달라진 시각은 측정을 다시 배열하지 말고 관찰 메모로 남깁니다.
4. 저장한 CSV에서 누락 구간을 확인한 뒤 이동평균, 변화량 또는 시간 추세를 계산합니다.`
}

function transientWorkbook(recipe: Recipe) {
  const repetitions = recipe.difficulty === '초급' ? 5 : 8
  return `## 실험 실행 계획

이 탐구는 정상 상태의 조건표를 채우는 실험이 아니라 **한 번의 운동이나 과도 변화 전체 파형**을 기록하는 실험입니다.

| 항목 | 권장값 | 실제 사용값 | 확인 |
|:---|---:|---:|:---:|
| 사건 전 기준 기록 | 2초 이상 |  | □ |
| 사건 전체 기록 | 시작 전부터 종료 후까지 |  | □ |
| 독립 시행 횟수 | ${repetitions}회 |  | □ |
| 시간 정보 | 모든 행에 타임스탬프 |  | □ |

1. 장치를 정지 상태로 두고 2초 이상 기준 신호를 기록한 뒤 한 번의 운동 또는 변화를 시작합니다.
2. 변화가 완전히 끝난 뒤까지 동일한 간격으로 원시 CSV를 연속 저장합니다.
3. 장치를 같은 시작 상태로 되돌린 뒤 총 ${repetitions}회의 독립 시행을 기록합니다.
4. 주기, 봉우리, 적분값, 시간상수 또는 에너지는 스케치에서 미리 확정하지 말고 저장한 CSV를 후처리하여 구합니다.`
}

function comparisonWorkbook(recipe: Recipe) {
  const { levels, repeats, samples, intervalSeconds, settlingSeconds } = samplingPlan(recipe)
  const totalRows = levels * repeats
  const durationMinutes = Math.max(1, Math.ceil(totalRows * (settlingSeconds + samples * intervalSeconds) / 60))
  return `## 실험 실행 계획

아래 수치는 기본 권장값입니다. 장치의 응답이 느리면 **안정화 시간만 늘리고**, 모든 조건에서 표본 수와 측정 간격은 같게 유지하세요.

| 항목 | 권장값 | 실제 사용값 | 확인 |
|:---|---:|---:|:---:|
| 독립 변인 조건 수 | ${levels}단계 |  | □ |
| 조건 간 반복 | ${repeats}회 |  | □ |
| 조건별 표본 수 | ${samples}개 |  | □ |
| 표본 간격 | ${intervalSeconds}초 |  | □ |
| 조건 변경 후 안정화 | ${settlingSeconds}초 |  | □ |
| 예상 순수 측정 시간 | 약 ${durationMinutes}분 |  | □ |

1. 전원을 넣고 센서값을 **60초간 예비 관찰**하여 영점, 측정 범위를 넘어 최댓값에 머무는 현상, 단선 여부를 확인합니다.
2. 독립 변인의 최솟값과 최댓값을 먼저 안전하게 확인한 뒤, 그 사이를 ${levels}단계로 등분합니다.
3. 각 조건에서 ${settlingSeconds}초 기다린 후 ${intervalSeconds}초 간격으로 ${samples}개를 저장합니다.
4. 조건 순서를 **낮음 → 높음**으로 1회, **높음 → 낮음**으로 1회 실시하고 나머지 1회는 무작위 순서로 측정합니다.
5. 총 **${totalRows}개 조건 묶음**이 빠짐없이 측정되었는지 조건 번호와 반복 번호를 확인합니다.`
}

export function withInquiryWorkbook(recipe: Recipe): Recipe {
  if (recipe.body.includes(GUIDE_MARKER)) return recipe
  const plan = experimentPlan(recipe)
  const { intervalSeconds } = samplingPlan(recipe)
  const executionPlan = plan === 'event'
    ? eventWorkbook(recipe)
    : plan === 'time-series'
      ? timeSeriesWorkbook(recipe, intervalSeconds)
      : plan === 'transient'
        ? transientWorkbook(recipe)
        : comparisonWorkbook(recipe)

  const workbook = `${GUIDE_MARKER}

${executionPlan}

## 과학 이론 쉽게 이해하기

${theoryPrimer(recipe, plan)}
`

  return {
    ...recipe,
    body: `${latexize(recipe.body.trim())}\n\n${workbook}`,
    sketch: formatArduinoCode(recipe.sketch),
  }
}
