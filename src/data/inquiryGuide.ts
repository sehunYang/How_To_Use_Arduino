import type { Recipe } from '@/schema'
import { formatArduinoCode } from '@/lib/formatArduinoCode'
import { sensorProfileById } from '@/data/sensorProfiles'
import { conceptById } from './inquiry/concepts'
import { describeHeader, findCsvHeader } from './inquiry/columns'
import type { InquiryPlan } from './inquiry/types'

const GUIDE_MARKER = '<!-- inquiry-workbook-v2 -->'

type ExperimentPlan = 'event' | 'time-series' | 'transient' | 'condition-comparison'

function experimentPlan(recipe: Recipe): ExperimentPlan {
  const headline = [recipe.id, recipe.title, recipe.coreKeywords.join(' ')]
    .join(' ')
    .toLowerCase()
  const description = `${headline} ${recipe.body} ${recipe.applicationGuide}`.toLowerCase()

  // 회전수·RPM류는 사건 하나하나가 아니라 조건별 집계를 다루므로 event가 아니라
  // 비교 실험으로 보낸다. PIR 통과 감지(S3)만 event로 남긴다.
  if (/(interrupt|인터럽트|이벤트|발생 시점|지나가면)/.test(headline)) {
    return 'event'
  }
  if (/(24시간|장시간|시계열|시간에 따른|시간 변화|시간 안정성|이동평균|시간 추세|변화량을 계산|온도 구배|열전달 방향|환경 기록)/.test(description)) {
    return 'time-series'
  }
  // transient를 제목 비교보다 먼저 검사한다. "물의 냉각 곡선 (뉴턴 냉각법칙)"이나
  // "충돌 전후 운동량 비교"처럼 제목에 '법칙'·'비교'가 들어 있어도 실제 측정은
  // 한 번의 과도 파형 기록이므로, 순서를 뒤에 두면 파형 실험이 조건표 실행
  // 계획을 받아 분석 절과 모순된다.
  if (/(pendulum-period|mechanical-energy|자유낙하|냉각 곡선|충돌 전후|반발계수|회전 감쇠|융해 잠열|충전|방전|시간상수|줄열|발열|흡열|에너지 보존|단진자|용수철|토리첼리|마찰에 의한)/.test(headline)) {
    return 'transient'
  }
  if (/(에 따른|별 |각도별|관계|분포|법칙|비교|효율)/.test(recipe.title)) {
    return 'condition-comparison'
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

// ── 레시피가 이미 쓴 본문 읽기 ────────────────────────────────────────────

interface AuthoredBody {
  /** `## 제목` 아래 내용. 제목이 열쇠입니다. */
  sections: Map<string, string>
  /** 이름 있는 절이 하나도 없는 센서 예제를 위해 첫 절의 내용을 따로 둡니다. */
  intro: string
  /** `:::callout warn`으로 적힌 안전 안내. */
  safety: string
  /** `:::toggle`로 접어 둔 심화 설명. */
  deepDive: string
}

/**
 * 본문을 다시 조립하려면 먼저 조각으로 나눠야 합니다. 이 저장소의 본문은 모두
 * 코드에서 생성하므로 문법이 고정되어 있고(`## 제목`, `:::callout`, `:::toggle`),
 * 그 약속을 그대로 이용합니다. 형식이 달라지면 조각이 비고, 그 경우 해당 절은
 * 아예 출력하지 않아 잘못된 안내가 나가지 않도록 했습니다.
 */
function parseAuthoredBody(body: string): AuthoredBody {
  const lines = body.split('\n')
  const markdown: string[] = []
  let safety = ''
  let deepDive = ''

  for (let index = 0; index < lines.length; index += 1) {
    const directive = /^:::(callout|toggle)(?:\s+(.+))?\s*$/.exec(lines[index])
    if (!directive) {
      markdown.push(lines[index])
      continue
    }
    const content: string[] = []
    index += 1
    while (index < lines.length && lines[index].trim() !== ':::') {
      content.push(lines[index])
      index += 1
    }
    const text = content.join('\n').trim()
    if (directive[1] === 'callout') safety = safety ? `${safety}\n\n${text}` : text
    else deepDive = deepDive ? `${deepDive}\n\n${text}` : text
  }

  const sections = new Map<string, string>()
  let intro = ''
  let currentHeading: string | null = null
  let buffer: string[] = []
  const flush = () => {
    const text = buffer.join('\n').trim()
    if (currentHeading === null) return
    if (!intro) intro = text
    sections.set(currentHeading, text)
    buffer = []
  }
  for (const line of markdown) {
    const heading = /^##\s+(.+?)\s*$/.exec(line)
    if (heading) {
      flush()
      currentHeading = heading[1]
      continue
    }
    if (currentHeading !== null) buffer.push(line)
  }
  flush()

  return { sections, intro, safety, deepDive }
}

/**
 * 한국어 문장은 `다.`나 `요.`로 끝납니다. 이 규칙으로 나누면 `4.7 kΩ`이나
 * `0.0625 °C` 같은 소수점을 문장 끝으로 잘못 읽지 않습니다.
 */
function toSteps(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[다요][.!?])\s+/))
    .map((sentence) => sentence.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
}

/**
 * 실제로 손을 움직이는 절만 각 줄 앞에 `□`를 답니다. 읽고 넘어가는 절과
 * 하나씩 해 나가는 절이 똑같이 생기면, 학생은 어디까지 했는지 표시할 곳이
 * 없어 같은 줄을 다시 읽습니다.
 */
function checklist(steps: string[], startAt = 1): string {
  return steps.map((step, index) => `${index + startAt}. □ ${step}`).join('\n')
}

// ── 새 가이드 절 만들기 ───────────────────────────────────────────────────

function overviewSection(recipe: Recipe, plan: InquiryPlan, authored: AuthoredBody): string {
  const apparatus = authored.sections.get('준비물')
  // 레시피가 쓴 '탐구 목표'는 Phase 6에서는 법칙 문장, Phase 5에서는 무엇을
  // 기록하는지에 대한 설명입니다. 둘 다 이론 절의 도입보다 요약 절의 머리말로
  // 두는 편이 자연스러워 여기에서 먼저 보여 줍니다.
  const lead = authored.sections.get('탐구 목표') || authored.intro
  const rows = [
    `| 이 탐구가 답하려는 질문 | ${plan.question} |`,
    `| 센서가 재는 것 | ${plan.measures} |`,
    `| 내가 바꾸는 것 | ${plan.changes} |`,
    `| 확인할 관계 | ${plan.relation} |`,
    `| 걸리는 시간 | 약 ${recipe.minutes}분 (${recipe.difficulty}) |`,
  ]
  if (apparatus) rows.push(`| 준비물 | ${apparatus.replace(/\n+/g, ' ')} |`)

  return `## 한눈에 보기

${lead}

| 항목 | 내용 |
|:---|:---|
${rows.join('\n')}`
}

function conceptList(plan: InquiryPlan): string {
  return plan.concepts
    .map((id) => {
      const concept = conceptById(id)
      const symbol = concept.symbol ? ` ${concept.symbol}` : ''
      const unit = concept.unit ? ` (단위 ${concept.unit})` : ''
      return `- **${concept.term}${symbol}${unit}** — ${concept.plain} ${concept.everyday}`
    })
    .join('\n')
}

function formulaBlock(plan: InquiryPlan): string {
  if (!plan.formula) return ''
  const { expression, symbols, prediction } = plan.formula
  const rows = symbols
    .map((entry) => `| ${entry.symbol} | ${entry.meaning} | ${entry.unit ?? '-'} |`)
    .join('\n')
  return `

### 이 탐구의 핵심 식

${expression}

| 기호 | 뜻 | 단위 |
|:---:|:---|:---|
${rows}

**측정하기 전에 예상해 보세요.** ${prediction}`
}

function sensorBridge(recipe: Recipe, plan: ExperimentPlan): string {
  const quantities = [...new Set(
    recipe.sensors.flatMap((id) => sensorProfileById.get(id)?.quantities ?? []),
  )]
  const names = recipe.sensors
    .map((id) => sensorProfileById.get(id)?.id.toUpperCase() ?? id.toUpperCase())
    .join(', ')
  const measured = quantities.length ? quantities.join(', ') : '측정값'
  const reading = plan === 'condition-comparison'
    ? '조건을 한 번에 하나씩만 바꾸고, 값이 어느 쪽으로 얼마나 달라지는지 견줍니다.'
    : '시각이 붙은 원시값을 먼저 그대로 저장하고, 변화 모양은 나중에 분석합니다.'

  return `

### 센서는 무엇을 대신해 주나요

| | |
|:---|:---|
| 쓰는 센서 | ${names} |
| 숫자로 바꿔 주는 값 | ${measured} |
| 사람이 하지 않아도 되는 일 | 같은 간격으로 값과 발생 시각을 함께 적기 |
| 위 관계를 확인하는 방법 | ${reading} |`
}

/**
 * 번호를 붙여 내보낼 절. 레시피에 따라 안전 안내나 측정 방법이 없을 수 있어서
 * 번호를 고정해 두면 3번 다음에 5번이 오는 가이드가 만들어집니다. 그래서 각
 * 절은 제목만 들고 있고, 번호는 실제로 출력되는 절만 세어 마지막에 붙입니다.
 */
type Section = { title: string; body: string } | null

function theorySection(recipe: Recipe, plan: InquiryPlan, kind: ExperimentPlan): Section {
  return {
    title: '과학 이론 쉽게 이해하기',
    body: `이 탐구가 확인하려는 것

> **${plan.relation}**

### 먼저 알아 둘 말

${conceptList(plan)}${formulaBlock(plan)}${sensorBridge(recipe, kind)}`,
  }
}

function variableSection(plan: InquiryPlan): Section {
  // 통제 변인은 표 칸 하나에 `1) … 2) … 3) …`으로 이어 붙어 있었습니다. 실제로는
  // 측정 내내 하나씩 확인해야 하는 목록이라, 칸 안의 줄글이 아니라 표 밖의
  // 체크 목록으로 내보냅니다.
  const controls = plan.variables.controls
    .map((item) => `- □ ${item}`)
    .join('\n')
  return {
    title: '변인 설계',
    body: `| 구분 | 이 탐구에서는 |
|:---|:---|
| 독립 변인 — 내가 단계적으로 바꾸는 것 | ${plan.variables.independent} |
| 종속 변인 — 센서가 재는 것 | ${plan.variables.dependent} |

**통제 변인 — 끝까지 같게 유지할 것**

${controls}`,
  }
}

function safetySection(authored: AuthoredBody): Section {
  if (!authored.safety) return null
  return {
    title: '안전 점검',
    body: `:::callout warn
${authored.safety}
:::`,
  }
}

/**
 * 시키는 문장이 아니라 사실을 말하는 문장의 어미.
 *
 * 반대로 "시키는 문장"을 골라내려 하면 레시피 두 갈래를 모두 잡지 못합니다.
 * 물리·환경 레시피는 `…하세요.`로, 생물·로봇과 Phase 6 레시피는 `…합니다.`로
 * 지시합니다. 그래서 **설명 쪽을 지목하고 나머지를 단계로 봅니다.** 판정이
 * 애매하면 단계로 남기는 편이 안전합니다. 설명에 체크 상자가 하나 붙는 것보다
 * 진짜 해야 할 일이 딸림 줄로 밀려나는 쪽이 훨씬 나쁩니다.
 */
const STATEMENT_ENDINGS = [
  '입니다',
  '있습니다',
  '없습니다',
  '작습니다',
  '큽니다',
  '적합합니다',
  '나오지 않습니다',
]

function isStatement(sentence: string): boolean {
  return STATEMENT_ENDINGS.some((ending) => new RegExp(`${ending}[.!?]$`).test(sentence))
}

/**
 * 레시피의 '측정 방법'은 시킬 일과 설명이 한 덩어리로 섞여 있습니다. 문장을
 * 그대로 번호로 늘어놓으면 "봉우리 수의 절반이 주기 수입니다"처럼 손으로 할 것이
 * 없는 문장에도 체크 상자가 붙어, 학생은 무엇을 해야 끝나는지 알 수 없습니다.
 * 설명은 번호를 받지 않고 바로 앞 단계의 딸림 줄이 됩니다.
 */
function toProcedure(sentences: string[]): string {
  const steps: Array<{ action: string; notes: string[] }> = []
  const lead: string[] = []
  for (const sentence of sentences) {
    if (!isStatement(sentence)) steps.push({ action: sentence, notes: [] })
    else if (steps.length) steps[steps.length - 1].notes.push(sentence)
    else lead.push(sentence)
  }
  if (!steps.length) return checklist(sentences)
  const body = steps
    .map((step, index) => [`${index + 1}. □ ${step.action}`, ...step.notes.map((note) => `   - ${note}`)].join('\n'))
    .join('\n')
  return lead.length ? `${lead.join(' ')}\n\n${body}` : body
}

function procedureSection(authored: AuthoredBody): Section {
  const steps = toSteps(authored.sections.get('측정 방법') ?? '')
  if (!steps.length) return null
  return { title: '측정 순서', body: toProcedure(steps) }
}

function columnSection(recipe: Recipe): Section {
  const header = findCsvHeader(recipe.sketch)
  if (!header) return null
  const rows = describeHeader(header)
    .map((column) => `| \`${column.name}\` | ${column.label} | ${column.unit || '-'} | ${column.use} |`)
    .join('\n')
  return {
    title: '측정값 읽는 법',
    body: `시리얼 모니터의 첫 줄이 열 이름, 그 아래가 측정값입니다.

| 열 이름 | 무엇인가 | 단위 | 어떻게 쓰나 |
|:---|:---|:---:|:---|
${rows}`,
  }
}

function analysisSection(plan: InquiryPlan, authored: AuthoredBody): Section {
  const steps = [...plan.analysis, ...toSteps(authored.sections.get('데이터 처리') ?? '')]
  if (!steps.length) return null
  return {
    title: '데이터 처리와 그래프',
    body: `저장한 CSV를 열어 순서대로 계산하세요. 원시값을 남겨 두었으므로 중간에 방법을 바꿔도 다시 측정하지 않아도 됩니다.

${checklist(steps)}`,
  }
}

function checkpointSection(plan: InquiryPlan): Section {
  if (!plan.checkpoints.length) return null
  const rows = plan.checkpoints
    .map((item) => `| ${item.sign} | ${item.meaning} |`)
    .join('\n')
  return {
    title: '결과 점검',
    body: `예상과 다른 결과도 훌륭한 자료입니다. 원인을 찾아 적어야 결론이 됩니다.

| 이런 결과가 나오면 | 이렇게 살펴보세요 |
|:---|:---|
${rows}`,
  }
}

function extensionSection(plan: InquiryPlan): Section {
  return {
    title: '더 나아가기',
    body: `1. **바로 해보기 —** ${plan.extensions.immediate}
2. **조건 넓히기 —** ${plan.extensions.broaden}
3. **다른 탐구로 —** ${plan.extensions.connect}`,
  }
}

function deepDiveSection(authored: AuthoredBody): string {
  if (!authored.deepDive) return ''
  return `:::toggle 원리와 오차 더 깊이 보기
${authored.deepDive}
:::`
}

// ── 실험 실행 계획(측정 설계) ─────────────────────────────────────────────

function eventWorkbook(recipe: Recipe) {
  const repetitions = recipe.difficulty === '초급' ? 10 : 15
  return `이 탐구는 조건을 단계별로 바꾸는 실험이 아니라 **사건이 발생한 시점과 센서 응답**을 기록하는 실험입니다.

| 항목 | 권장값 | 실제 사용값 | 확인 |
|:---|---:|---:|:---:|
| 예비 관찰 시간 | 60초 |  | □ |
| 사건 반복 횟수 | ${repetitions}회 |  | □ |
| 사건 사이 최소 간격 | 3초 |  | □ |
| 기록할 시간 정보 | 발생 시각·응답 시각 |  | □ |

1. □ 60초간 예비 관찰하여 사건이 없을 때의 신호 범위와 오검출 여부를 확인합니다.
2. □ 사건을 ${repetitions}회 독립적으로 일으키고 각 발생 시각과 센서가 검출한 시각을 빠짐없이 저장합니다.
3. □ 한 사건의 신호가 끝난 뒤 다음 사건을 일으켜 서로 겹치지 않게 합니다.
4. □ 저장한 CSV에서 누락률, 오검출률, 응답 지연과 반복 간 차이를 계산합니다.`
}

function timeSeriesWorkbook(recipe: Recipe, intervalSeconds: number) {
  const durationMinutes = recipe.sensors.some((sensor) => sensor === 'ds18b20' || sensor === 'bme280') ? 30 : 10
  return `이 탐구는 **끊김 없는 연속 기록**에서 시간에 따른 변화를 찾는 실험입니다.

| 항목 | 권장값 | 실제 사용값 | 확인 |
|:---|---:|---:|:---:|
| 예비 관찰 시간 | 60초 |  | □ |
| 연속 기록 시간 | ${durationMinutes}분 이상 |  | □ |
| 기록 간격 | ${intervalSeconds}초 |  | □ |
| 함께 기록할 환경 정보 | 시작·종료 시각과 관찰 메모 |  | □ |

1. □ 센서 시각과 실제 시작 시각을 기록하고 60초간 예비 관찰하여 단선과 측정 범위 초과를 확인합니다.
2. □ ${intervalSeconds}초 간격으로 ${durationMinutes}분 이상 중단 없이 원시 CSV를 저장합니다.
3. □ 장치를 만지거나 주변 환경이 달라진 시각은 측정을 다시 배열하지 말고 관찰 메모로 남깁니다.
4. □ 저장한 CSV에서 누락 구간을 확인한 뒤 이동평균, 변화량 또는 시간 추세를 계산합니다.`
}

function transientWorkbook(recipe: Recipe) {
  const repetitions = recipe.difficulty === '초급' ? 5 : 8
  return `이 탐구는 정상 상태의 조건표를 채우는 실험이 아니라 **한 번의 운동이나 과도 변화 전체 파형**을 기록하는 실험입니다.

| 항목 | 권장값 | 실제 사용값 | 확인 |
|:---|---:|---:|:---:|
| 사건 전 기준 기록 | 2초 이상 |  | □ |
| 사건 전체 기록 | 시작 전부터 종료 후까지 |  | □ |
| 독립 시행 횟수 | ${repetitions}회 |  | □ |
| 시간 정보 | 모든 행에 발생 시각 기록 |  | □ |

1. □ 장치를 정지 상태로 두고 2초 이상 기준 신호를 기록한 뒤 한 번의 운동 또는 변화를 시작합니다.
2. □ 변화가 완전히 끝난 뒤까지 동일한 간격으로 원시 CSV를 연속 저장합니다.
3. □ 장치를 같은 시작 상태로 되돌린 뒤 총 ${repetitions}회의 독립 시행을 기록합니다.
4. □ 주기, 봉우리, 적분값, 시간상수 또는 에너지는 스케치에서 미리 확정하지 말고 저장한 CSV를 후처리하여 구합니다.`
}

function comparisonWorkbook(recipe: Recipe) {
  const { levels, repeats, samples, intervalSeconds, settlingSeconds } = samplingPlan(recipe)
  const totalRows = levels * repeats
  const durationMinutes = Math.max(1, Math.ceil(totalRows * (settlingSeconds + samples * intervalSeconds) / 60))
  return `아래 수치는 기본 권장값입니다. 고칠 때는 이 규칙을 지키세요.

- 변인 설계에 조건 수가 따로 적혀 있으면 **그 값을 우선**합니다.
- 장치의 응답이 느리면 **안정화 시간만** 늘립니다.
- 표본 수와 측정 간격은 **모든 조건에서 같게** 유지합니다.
- 안정화 시간 자체가 분석 대상이면 기다리지 말고 조건을 바꾼 순간부터 계속 기록합니다.

| 항목 | 권장값 | 실제 사용값 | 확인 |
|:---|---:|---:|:---:|
| 독립 변인 조건 수 | ${levels}단계 |  | □ |
| 조건 간 반복 | ${repeats}회 |  | □ |
| 조건별 표본 수 | ${samples}개 |  | □ |
| 표본 간격 | ${intervalSeconds}초 |  | □ |
| 조건 변경 후 안정화 | ${settlingSeconds}초 |  | □ |
| 예상 순수 측정 시간 | 약 ${durationMinutes}분 |  | □ |

1. □ 전원을 넣고 센서값을 **60초간 예비 관찰**하여 영점, 측정 범위를 넘어 최댓값에 머무는 현상, 단선 여부를 확인합니다.
2. □ 독립 변인의 최솟값과 최댓값을 먼저 안전하게 확인한 뒤, 그 사이를 ${levels}단계로 등분합니다.
3. □ 각 조건에서 ${settlingSeconds}초 기다린 후 ${intervalSeconds}초 간격으로 ${samples}개를 저장합니다.
4. □ 조건 순서를 **낮음 → 높음**으로 1회, **높음 → 낮음**으로 1회 실시하고 나머지 1회는 무작위 순서로 측정합니다.
5. □ 총 **${totalRows}개 조건 묶음**이 빠짐없이 측정되었는지 조건 번호와 반복 번호를 확인합니다.`
}

function executionSection(recipe: Recipe, kind: ExperimentPlan, intervalSeconds: number): Section {
  const body = kind === 'event'
    ? eventWorkbook(recipe)
    : kind === 'time-series'
      ? timeSeriesWorkbook(recipe, intervalSeconds)
      : kind === 'transient'
        ? transientWorkbook(recipe)
        : comparisonWorkbook(recipe)
  return { title: '실험 실행 계획', body }
}

/**
 * 레시피가 이미 쓴 본문을 조각으로 나눈 뒤, 이론 → 변인 → 안전 → 측정 → 자료
 * 처리 → 확장 순서로 다시 조립합니다. 이론을 뒤가 아니라 앞에 두는 것이
 * 핵심입니다. 무엇을 왜 재는지 모른 채 배선부터 따라 하면 표만 채우고 끝나기
 * 때문입니다.
 *
 * 탐구 설계를 여기서 직접 찾지 않고 **부르는 쪽이 넘겨 주는** 이유는 번들
 * 크기 때문입니다. 전체 설계 모음을 이 파일에서 가져오면, 레시피 하나만 쓰는
 * 화면에서도 78개 분량의 한국어 설명이 첫 화면 번들에 함께 실립니다. 단계별
 * 설계만 넘기면 그 단계의 것만 실립니다.
 */
export function withInquiryWorkbook(plans: Record<string, InquiryPlan>) {
  return (recipe: Recipe): Recipe => buildGuide(recipe, plans[recipe.id])
}

function buildGuide(recipe: Recipe, plan: InquiryPlan | undefined): Recipe {
  if (recipe.body.includes(GUIDE_MARKER)) return recipe

  const authored = parseAuthoredBody(latexize(recipe.body.trim()))
  const kind = experimentPlan(recipe)
  const { intervalSeconds } = samplingPlan(recipe)

  // 계획이 아직 없는 레시피도 빈 표 대신 최소한의 안내는 받아야 하므로,
  // 계획이 있어야만 만들 수 있는 절만 빼고 나머지는 그대로 내보냅니다.
  const sections: Section[] = plan
    ? [
        theorySection(recipe, plan, kind),
        variableSection(plan),
        safetySection(authored),
        // 몇 번 반복할지 정한 다음에 손을 대야 합니다. 순서가 반대면 학생은
        // 측정을 다 끝낸 뒤에야 시행 횟수가 모자랐다는 것을 알게 됩니다.
        executionSection(recipe, kind, intervalSeconds),
        procedureSection(authored),
        columnSection(recipe),
        analysisSection(plan, authored),
        checkpointSection(plan),
        extensionSection(plan),
      ]
    : [
        safetySection(authored),
        executionSection(recipe, kind, intervalSeconds),
        procedureSection(authored),
        columnSection(recipe),
      ]

  const head = plan ? overviewSection(recipe, plan, authored) : latexize(recipe.body.trim())
  const numberedSections = sections
    .filter((section): section is NonNullable<Section> => section !== null)
    .map((section, index) => `## ${index + 1}. ${section.title}\n\n${section.body}`)

  const body = [GUIDE_MARKER, head, ...numberedSections, deepDiveSection(authored)]
    .filter(Boolean)
    .join('\n\n')

  return { ...recipe, body }
}

/**
 * 스케치를 학생이 읽기 좋은 줄바꿈으로 다시 정리합니다.
 *
 * 가이드 조립과 분리해 둔 이유가 있습니다. `verifyHash`는 본문이 아니라
 * 스케치·배선·바꿔볼 값에서 계산되므로(`computeVerifyHash` 참고), 스케치를
 * 건드리면 이미 검증을 마친 레시피의 해시가 함께 바뀝니다. 카나리 레시피처럼
 * 손으로 다듬어 둔 스케치가 컴파일·시뮬레이션 픽스처로 쓰이는 경우에는
 * 가이드만 새로 붙이고 스케치는 그대로 두어야 합니다.
 */
export function withFormattedSketch(recipe: Recipe): Recipe {
  return { ...recipe, sketch: formatArduinoCode(recipe.sketch) }
}
