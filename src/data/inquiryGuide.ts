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
  const repeats = 3
  const samples = recipe.difficulty === '초급' ? 20 : 30
  const intervalSeconds = recipe.sensors.some((sensor) => sensor === 'ds18b20' || sensor === 'bme280')
    ? 2
    : 1
  const settlingSeconds = recipe.sensors.includes('ds18b20') ? 60 : recipe.sensors.includes('bme280') ? 30 : 10
  return { repeats, samples, intervalSeconds, settlingSeconds }
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
 * 손을 움직이는 절은 번호 있는 **체크 목록**으로 냅니다.
 *
 * 예전에는 `□`를 글자로 찍었는데, 눌러도 아무 일이 없어 고장 난 것처럼
 * 보였습니다. GFM 과제 목록 문법(`1. [ ]`)으로 쓰면 화면 쪽에서 진짜 상자로
 * 바꿔 그리고, 체크한 자리가 브라우저에 남습니다(`SafeMarkdown`의
 * `checklistScope` 참고). 번호는 순서 있는 목록이라 그대로 붙습니다.
 */
function checklist(steps: string[], startAt = 1): string {
  return steps.map((step, index) => `${index + startAt}. [ ] ${step}`).join('\n')
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
  // 출력 장치 예제처럼 센서를 쓰지 않는 레시피는 이 절을 아예 내지 않습니다.
  // 빈 이름으로 "쓰는 센서는 입니다" 같은 문장을 내보내지 않기 위해서입니다.
  if (!recipe.sensors.length) return ''
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
    .map((item) => `- [ ] ${item}`)
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

/**
 * `붙입니다`, `섞입니다`처럼 어간에 `-이다`가 붙는 **동사**는 글자만 보면
 * `입니다`로 끝납니다. 이것을 사실 문장으로 읽으면 "센서를 추에 붙입니다"라는
 * 진짜 지시가 딸림 줄로 밀려납니다. 그 어간들을 앞에서 걸러 냅니다.
 */
const VERB_STEMS_BEFORE_IPNIDA = ['붙', '섞', '기울', '높', '줄', '늘', '쌓', '보', '쓰', '놓', '먹', '모', '녹']

export function isStatement(sentence: string): boolean {
  return STATEMENT_ENDINGS.some((ending) => {
    const guard = ending === '입니다' ? `(?<!${VERB_STEMS_BEFORE_IPNIDA.join('|')})` : ''
    return new RegExp(`${guard}${ending}[.!?]$`).test(sentence)
  })
}

/**
 * 레시피의 '측정 방법'은 시킬 일과 설명이 한 덩어리로 섞여 있습니다. 문장을
 * 그대로 번호로 늘어놓으면 "봉우리 수의 절반이 주기 수입니다"처럼 손으로 할 것이
 * 없는 문장에도 체크 상자가 붙어, 학생은 무엇을 해야 끝나는지 알 수 없습니다.
 * 설명은 번호를 받지 않고 바로 앞 단계의 딸림 줄이 됩니다.
 */
function toProcedure(setup: string[], sentences: string[]): string {
  // 장치를 놓고 조립하는 단계(`setup`)를 먼저, 레시피가 쓴 측정 방법을 이어
  // 한 줄기 번호로 냅니다. 목록이 둘로 나뉘어 각각 1번부터 다시 시작하면
  // 학생은 지금이 몇 번째인지 셀 수 없습니다.
  //
  // 조립 단계는 "무엇을 한다"에 "왜 그렇게 한다"가 붙어 있는 경우가 많습니다.
  // 첫 문장만 체크 상자를 받고 나머지는 딸림 줄로 내립니다. 이유까지 체크할
  // 일로 만들면 무엇을 해야 끝나는지 흐려지고, 이유를 지우면 학생은 왜 그렇게
  // 놓아야 하는지 모른 채 따라 하게 됩니다.
  const steps: Array<{ action: string; notes: string[] }> = setup.map((entry) => {
    const [action, ...notes] = entry.split(/(?<=[다요][.!?])\s+/)
    return { action, notes }
  })
  const lead: string[] = []
  for (const sentence of sentences) {
    if (!isStatement(sentence)) steps.push({ action: sentence, notes: [] })
    else if (steps.length) steps[steps.length - 1].notes.push(sentence)
    else lead.push(sentence)
  }
  if (!steps.length) return checklist(sentences)
  const body = steps
    .map((step, index) => [
      `${index + 1}. [ ] ${step.action}`,
      // 딸림 줄은 할 일이 아니라 설명이므로 상자를 주지 않습니다.
      ...step.notes.map((note) => `   - ${note}`),
    ].join('\n'))
    .join('\n')
  return lead.length ? `${lead.join(' ')}\n\n${body}` : body
}

function procedureSection(plan: InquiryPlan, authored: AuthoredBody): Section {
  const measurement = toSteps(authored.sections.get('측정 방법') ?? '')
  if (!plan.setup.length && !measurement.length) return null
  return { title: '탐구 순서', body: toProcedure(plan.setup, measurement) }
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

/** 글자 두 개씩 겹쳐 보는 방식으로 잰 두 문장의 닮은 정도(0~1). */
export function similarity(left: string, right: string): number {
  const pairs = (text: string) => {
    const letters = text.replace(/[^0-9A-Za-z가-힣]/g, '')
    const out = new Set<string>()
    for (let index = 0; index + 1 < letters.length; index += 1) out.add(letters.slice(index, index + 2))
    return out
  }
  const a = pairs(left)
  const b = pairs(right)
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const pair of a) if (b.has(pair)) shared += 1
  return (2 * shared) / (a.size + b.size)
}

/**
 * 이 값을 넘으면 "이미 한 말"로 봅니다. 0.28은 눈으로 맞춘 값입니다. 더 낮추면
 * 원문에만 있는 센서 한계·단위 설명까지 함께 사라지고, 더 높이면 기호만 바꿔
 * 쓴 같은 계산이 그대로 남습니다.
 */
export const RESTATEMENT_THRESHOLD = 0.28

/**
 * 레시피 원문의 '데이터 처리'는 한 줄짜리 요약이고, 탐구 설계의 계산 단계는 그
 * 요약을 학생이 손으로 따라 할 수 있게 풀어 쓴 것입니다. 둘을 그냥 이어 붙이면
 * 같은 계산이 두 번 나오는데, 뒤에 오는 원문 쪽이 기호가 훨씬 많습니다. 학생은
 * 앞에서 이미 한 일을 알아보지 못하고 "이건 또 뭘 하라는 거지"에서 멈춥니다.
 * 그래서 앞 단계와 닮은 문장은 버리고, 원문에만 있는 내용(센서 분해능, 단위,
 * 기대할 만한 값의 크기 같은 것)은 그대로 남깁니다.
 */
function analysisSection(plan: InquiryPlan, authored: AuthoredBody): Section {
  const authoredSteps = toSteps(authored.sections.get('데이터 처리') ?? '')
    .filter((sentence) => !plan.analysis.some((step) => similarity(step, sentence) > RESTATEMENT_THRESHOLD))
  const steps = [...plan.analysis, ...authoredSteps]
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

| 항목 | 권장값 |
|:---|---:|
| 예비 관찰 시간 | 60초 |
| 사건 반복 횟수 | ${repetitions}회 |
| 사건 사이 최소 간격 | 3초 |
| 기록할 시간 정보 | 발생 시각·응답 시각 |

1. [ ] 60초간 예비 관찰하여 사건이 없을 때의 신호 범위와 오검출 여부를 확인합니다.
2. [ ] 사건을 ${repetitions}회 독립적으로 일으키고 각 발생 시각과 센서가 검출한 시각을 빠짐없이 저장합니다.
3. [ ] 한 사건의 신호가 끝난 뒤 다음 사건을 일으켜 서로 겹치지 않게 합니다.
4. [ ] 저장한 CSV에서 누락률, 오검출률, 응답 지연과 반복 간 차이를 계산합니다.`
}

function timeSeriesWorkbook(recipe: Recipe, intervalSeconds: number) {
  const durationMinutes = recipe.sensors.some((sensor) => sensor === 'ds18b20' || sensor === 'bme280') ? 30 : 10
  return `이 탐구는 **끊김 없는 연속 기록**에서 시간에 따른 변화를 찾는 실험입니다.

| 항목 | 권장값 |
|:---|---:|
| 예비 관찰 시간 | 60초 |
| 연속 기록 시간 | ${durationMinutes}분 이상 |
| 기록 간격 | ${intervalSeconds}초 |
| 함께 기록할 환경 정보 | 시작·종료 시각과 관찰 메모 |

1. [ ] 센서 시각과 실제 시작 시각을 기록하고 60초간 예비 관찰하여 단선과 측정 범위 초과를 확인합니다.
2. [ ] ${intervalSeconds}초 간격으로 ${durationMinutes}분 이상 중단 없이 원시 CSV를 저장합니다.
3. [ ] 장치를 만지거나 주변 환경이 달라진 시각은 측정을 다시 배열하지 말고 관찰 메모로 남깁니다.
4. [ ] 저장한 CSV에서 누락 구간을 확인한 뒤 이동평균, 변화량 또는 시간 추세를 계산합니다.`
}

function transientWorkbook(recipe: Recipe) {
  const repetitions = recipe.difficulty === '초급' ? 5 : 8
  return `이 탐구는 정상 상태의 조건표를 채우는 실험이 아니라 **한 번의 운동이나 과도 변화 전체 파형**을 기록하는 실험입니다.

| 항목 | 권장값 |
|:---|---:|
| 사건 전 기준 기록 | 2초 이상 |
| 사건 전체 기록 | 시작 전부터 종료 후까지 |
| 독립 시행 횟수 | ${repetitions}회 |
| 시간 정보 | 모든 행에 발생 시각 기록 |

1. [ ] 장치를 정지 상태로 두고 2초 이상 기준 신호를 기록한 뒤 한 번의 운동 또는 변화를 시작합니다.
2. [ ] 변화가 완전히 끝난 뒤까지 동일한 간격으로 원시 CSV를 연속 저장합니다.
3. [ ] 장치를 같은 시작 상태로 되돌린 뒤 총 ${repetitions}회의 독립 시행을 기록합니다.
4. [ ] 주기, 봉우리, 적분값, 시간상수 또는 에너지는 스케치에서 미리 확정하지 말고 저장한 CSV를 후처리하여 구합니다.`
}

/**
 * 조건을 바꿔 가며 견주는 탐구의 실행 계획.
 *
 * 조건 수는 **지어내지 않고 변인 설계에 적힌 문장을 그대로 옮깁니다.** 예전에는
 * 난이도에서 "초급이면 5단계" 식으로 숫자를 만들어 냈는데, 그러면 변인 설계에
 * "단열재 종류 3~4가지"라고 적힌 탐구에서도 "최솟값과 최댓값 사이를 5단계로
 * 등분하라"는 지시가 나갔습니다. 재료 종류는 등분할 수 있는 것이 아니라서,
 * 탐구가 서툰 학생은 두 절이 서로 다른 말을 하는 자리에서 그대로 멈춥니다.
 *
 * 측정 순서도 "낮음 → 높음"이 아니라 "적어 둔 차례대로"로 씁니다. 크기 순으로
 * 놓을 수 없는 조건에도 그대로 통하면서, 순서를 바꿔 재는 이유(순서가 만드는
 * 치우침 걸러 내기)를 함께 알려 줄 수 있습니다.
 */
function comparisonWorkbook(recipe: Recipe, plan: InquiryPlan | undefined) {
  const { repeats, samples, intervalSeconds, settlingSeconds } = samplingPlan(recipe)
  const conditions = plan?.variables.independent ?? '변인 설계에 적은 조건'
  // 조건 하나가 그 자체로 시간에 따라 변해 가는 탐구(냉각 곡선, 발효 압력,
  // 되먹임 회복 시간…)에서는 "안정된 뒤 30개"라는 지시가 성립하지 않습니다.
  // 값이 끝내 안정되지 않거나, 안정되기까지의 모양 자체가 답이기 때문입니다.
  const curve = plan?.recording === 'curve'

  const rows = [
    `| 바꿔 가며 잴 조건 | ${conditions} |`,
    `| 조건마다 반복 | ${repeats}회 |`,
    curve
      ? `| 조건마다 기록할 구간 | 조건을 시작한 순간부터 변화가 멎을 때까지 통째로 |`
      : `| 조건마다 저장할 표본 수 | ${samples}개 |`,
    `| 표본 간격 | ${intervalSeconds}초 |`,
    curve
      ? `| 기록을 멈추는 시점 | 변화가 멎었을 때 또는 정해 둔 관찰 시간이 끝났을 때 |`
      : `| 조건을 바꾼 뒤 기다릴 시간 | ${settlingSeconds}초 |`,
  ]

  const record = curve
    ? `조건을 시작한 순간부터 ${intervalSeconds}초 간격으로 끊지 말고 저장하고, 값이 더 이상 변하지 않거나 정해 둔 관찰 시간이 끝나면 멈춥니다. 조건마다 걸린 시간이 서로 달라도 그대로 둡니다.`
    : `조건을 바꾼 뒤 ${settlingSeconds}초 기다려 값이 안정되면 ${intervalSeconds}초 간격으로 ${samples}개를 저장합니다.`

  // 규칙은 표에 실제로 있는 칸만 이야기해야 합니다. 표에 없는 "기다리는 시간"을
  // 늘리라고 하면 학생은 없는 칸을 찾아 헤맵니다.
  const rules = curve
    ? [
        '- 측정 간격은 **모든 조건에서 같게** 유지합니다.',
        '- 조건마다 기록이 걸린 시간은 서로 달라도 됩니다. 얼마나 걸렸는지가 결과의 일부입니다.',
        '- 기록 도중 장치를 건드렸다면 그 부분을 지우지 말고 몇 분쯤이었는지 노트에 적어 둡니다.',
      ]
    : [
        '- 장치의 응답이 느리면 **기다리는 시간만** 늘립니다.',
        '- 표본 수와 측정 간격은 **모든 조건에서 같게** 유지합니다.',
        '- 값이 안정되기까지 걸리는 시간 자체가 알고 싶은 것이라면, 기다리지 말고 조건을 바꾼 순간부터 계속 기록합니다.',
      ]

  return `아래 수치는 기본 권장값입니다. 고칠 때는 이 규칙을 지키세요.

${rules.join('\n')}

| 항목 | 권장값 |
|:---|---:|
${rows.join('\n')}

1. [ ] 전원을 넣고 센서값을 **60초간 예비 관찰**하여 아무 자극이 없을 때의 기준값(영점), 값이 한계에 붙어 더 변하지 않는지, 선이 빠지지 않았는지를 확인합니다.
2. [ ] 위 표의 조건을 실험 노트에 하나씩 줄로 적고, 조건마다 이름을 붙여 스케치가 찍는 조건 이름과 맞춥니다.
3. [ ] 첫 조건과 마지막 조건을 한 번씩 미리 시험해 장치가 그 범위를 견디는지 확인합니다.
4. [ ] ${record}
5. [ ] 조건 순서를 적어 둔 차례대로 1회, 거꾸로 1회, 무작위로 1회 측정합니다. 순서 때문에 생기는 치우침은 이렇게만 걸러 낼 수 있습니다.
6. [ ] 적어 둔 조건이 저마다 ${repeats}회씩 빠짐없이 채워졌는지 조건 이름과 반복 번호로 확인합니다.`
}

function executionSection(
  recipe: Recipe,
  kind: ExperimentPlan,
  intervalSeconds: number,
  plan: InquiryPlan | undefined,
): Section {
  const body = kind === 'event'
    ? eventWorkbook(recipe)
    : kind === 'time-series'
      ? timeSeriesWorkbook(recipe, intervalSeconds)
      : kind === 'transient'
        ? transientWorkbook(recipe)
        : comparisonWorkbook(recipe, plan)
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
        executionSection(recipe, kind, intervalSeconds, plan),
        procedureSection(plan, authored),
        columnSection(recipe),
        analysisSection(plan, authored),
        checkpointSection(plan),
        extensionSection(plan),
      ]
    : [
        safetySection(authored),
        executionSection(recipe, kind, intervalSeconds, plan),
        // 설계가 없는 레시피는 조립 단계도 없으므로 측정 방법만 냅니다.
        procedureSection({ setup: [] } as unknown as InquiryPlan, authored),
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
