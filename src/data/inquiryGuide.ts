import type { Recipe } from '@/schema'
import { formatArduinoCode } from '@/lib/formatArduinoCode'

const GUIDE_MARKER = '<!-- inquiry-workbook-v1 -->'

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
    [/\bV=IR\b/g, '$V=IR$'],
    [/\bP=VI=I²R\b/g, '$P=VI=I^2R$'],
    [/\bP=VI\b/g, '$P=VI$'],
    [/\bV=E-Ir\b/g, '$V=E-Ir$'],
    [/\bB≈μ₀nI\b/g, '$B\\approx\\mu_0 nI$'],
    [/\bF=ma\b/g, '$F=ma$'],
    [/\bRₑq=ΣR\b/g, '$R_{\\mathrm{eq}}=\\sum R_i$'],
    [/\b1\/Rₑq=Σ\(1\/R\)/g, '$\\frac{1}{R_{\\mathrm{eq}}}=\\sum_i\\frac{1}{R_i}$'],
  ]
  return replacements.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), source)
}

function firstParagraph(source: string) {
  return source
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/^#+\s+.*$/gm, '').trim())
    .find((paragraph) => paragraph && !paragraph.startsWith(':::')) ?? ''
}

function theoryPrimer(recipe: Recipe) {
  const targetSection = recipe.body.includes('## 변인')
    ? recipe.body.match(/## 탐구 목표\s+([\s\S]*?)(?=\n## |\n:::|$)/)?.[1] ?? ''
    : recipe.body.match(/:::toggle [^\n]*(?:원리|과학|한계)[^\n]*\n([\s\S]*?)\n:::/)?.[1] ?? ''
  const fallback = recipe.body.match(/^## [^\n]+\s+([\s\S]*?)(?=\n## |\n:::|$)/)?.[1] ?? ''
  const explanation = firstParagraph(targetSection) || firstParagraph(fallback)

  return `센서는 눈으로 정확히 비교하기 어려운 변화를 전기 신호와 숫자로 바꾸어 보여 주는 도구입니다. ${explanation} 이 실험에서는 한 번에 한 조건만 바꾸고 측정값이 어느 방향으로 얼마나 달라지는지 비교하면 이 관계를 확인할 수 있습니다.`
}

export function withInquiryWorkbook(recipe: Recipe): Recipe {
  if (recipe.body.includes(GUIDE_MARKER)) return recipe
  const { levels, repeats, samples, intervalSeconds, settlingSeconds } = samplingPlan(recipe)
  const totalRows = levels * repeats
  const durationMinutes = Math.max(1, Math.ceil(totalRows * (settlingSeconds + samples * intervalSeconds) / 60))

  const workbook = `${GUIDE_MARKER}

## 실험 실행 계획

아래 수치는 기본 권장값입니다. 장치의 응답이 느리면 **안정화 시간만 늘리고**, 모든 조건에서 표본 수와 측정 간격은 같게 유지하세요.

| 항목 | 권장값 | 실제 사용값 | 확인 |
|:---|---:|---:|:---:|
| 독립 변인 조건 수 | ${levels}단계 |  | □ |
| 조건 간 반복 | ${repeats}회 |  | □ |
| 조건별 표본 수 | ${samples}개 |  | □ |
| 표본 간격 | ${intervalSeconds}초 |  | □ |
| 조건 변경 후 안정화 | ${settlingSeconds}초 |  | □ |
| 예상 순수 측정 시간 | 약 ${durationMinutes}분 |  | □ |

1. 전원을 넣고 센서값을 **60초간 예비 관찰**하여 영점, 포화, 단선 여부를 확인합니다.
2. 독립 변인의 최솟값과 최댓값을 먼저 안전하게 확인한 뒤, 그 사이를 ${levels}단계로 등분합니다.
3. 각 조건에서 ${settlingSeconds}초 기다린 후 ${intervalSeconds}초 간격으로 ${samples}개를 저장합니다.
4. 조건 순서를 **낮음 → 높음**으로 1회, **높음 → 낮음**으로 1회 실시하고 나머지 1회는 무작위 순서로 측정합니다.
5. 총 **${totalRows}개 조건 묶음**이 빠짐없이 측정되었는지 조건 번호와 반복 번호를 확인합니다.

## 과학 이론 쉽게 이해하기

${theoryPrimer(recipe)}
`

  return {
    ...recipe,
    body: `${latexize(recipe.body.trim())}\n\n${workbook}`,
    sketch: formatArduinoCode(recipe.sketch),
  }
}
