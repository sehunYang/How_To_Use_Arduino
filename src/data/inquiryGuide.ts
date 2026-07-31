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
5. 총 **${totalRows}개 조건 묶음**을 확보하고, 원본 CSV는 수정하지 않은 채 분석용 사본을 만듭니다.

## 측정 기록표

| 조건 번호 | 독립 변인 설정값 | 실제 측정값 | 단위 | 반복 | 평균 | 표준편차 | 관찰·이상치 메모 |
|---:|---:|---:|:---:|---:|---:|---:|:---|
| 1 |  |  |  | 1 |  |  |  |
| 1 |  |  |  | 2 |  |  |  |
| 1 |  |  |  | 3 |  |  |  |
| 2 |  |  |  | 1 |  |  |  |
| 2 |  |  |  | 2 |  |  |  |
| 2 |  |  |  | 3 |  |  |  |

> 표에는 설정값뿐 아니라 센서가 읽은 **실제값과 단위**를 함께 적으세요. 이상치는 삭제하기 전에 발생 시각과 원인을 메모합니다.

## 계산과 그래프

조건별 표본 $x_1, x_2, \\ldots, x_n$의 평균과 표본 표준편차는 다음과 같이 계산합니다.

$$
\\bar{x}=\\frac{1}{n}\\sum_{i=1}^{n}x_i
$$

$$
s=\\sqrt{\\frac{1}{n-1}\\sum_{i=1}^{n}(x_i-\\bar{x})^2}
$$

이론값 $x_{\\mathrm{theory}}$와 비교할 때는 상대오차를 사용합니다.

$$
\\text{relative error}(\\%)=
\\left|\\frac{x_{\\mathrm{measured}}-x_{\\mathrm{theory}}}
{x_{\\mathrm{theory}}}\\right|\\times100
$$

- 그래프의 $x$축에는 독립 변인과 단위를, $y$축에는 종속 변인과 단위를 표기합니다.
- 각 점은 $\\bar{x}$로 표시하고 가능하면 오차막대 $\\pm s$를 추가합니다.
- 선형 관계라면 $y=ax+b$로 회귀하여 기울기 $a$, 절편 $b$, 결정계수 $R^2$를 기록합니다.
- 결론에는 “증가했다” 대신 **기울기, 변화율, 상대오차와 불확도**를 수치로 제시합니다.
`

  return {
    ...recipe,
    body: `${latexize(recipe.body.trim())}\n\n${workbook}`,
    sketch: formatArduinoCode(recipe.sketch),
  }
}
