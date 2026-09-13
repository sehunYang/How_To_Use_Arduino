import { describe, expect, it } from 'vitest'
import { ina219CurrentRecipe, multiTsl2591Recipe, pendulumRecipe } from '@/data/canary'
import { phase5Recipes } from '@/data/phase5'
import { phase6Recipes } from '@/data/phase6'
import { phase7Recipes } from '@/data/phase7'
import { concepts } from '@/data/inquiry/concepts'
import { findCsvHeader } from '@/data/inquiry/columns'
import { formatArduinoCode } from '@/lib/formatArduinoCode'
import { inquiryPlans } from '@/data/inquiry/plans'
import { apparatusFor } from '@/recipes/parts'
import { RESTATEMENT_THRESHOLD, inquiryQuestion, isStatement, similarity, splitGuide } from '@/data/inquiryGuide'

const canaryRecipes = [pendulumRecipe, multiTsl2591Recipe, ina219CurrentRecipe]
const allRecipes = [...canaryRecipes, ...phase5Recipes, ...phase6Recipes, ...phase7Recipes]

function recipe(id: string) {
  const found = allRecipes.find((candidate) => candidate.id === id)
  expect(found, `missing recipe ${id}`).toBeDefined()
  return found!
}

/**
 * 본문에서 `### 4-N. 제목` 형태의 절 제목만 순서대로 뽑습니다.
 *
 * 번호가 화면 절의 하위 번호(`4-`)이고 제목도 한 단계 낮은 이유는
 * `inquiryGuide.ts`의 `GUIDE_SECTION_NUMBER` 설명에 적어 두었습니다.
 */
/**
 * 가이드 절의 번호와 제목. 단계 번호를 받는 이유는 가이드가 두 화면으로 갈렸기
 * 때문입니다. 설계 절은 `4-1`부터, 측정 절은 `5-1`부터 다시 셉니다.
 */
function numberedHeadings(body: string, step: 4 | 5 = 4) {
  return [...body.matchAll(new RegExp(String.raw`^### ${step}-(\d+)\. (.+)$`, 'gm'))].map((match) => ({
    index: Number(match[1]),
    title: match[2],
  }))
}

describe('inquiry workbook experiment plans', () => {
  it.each(['p1-pendulum-period', 'p2-mechanical-energy', 'ph21-rc-time-constant'])(
    'uses a transient recording plan for %s',
    (id) => {
      const body = recipe(id).body
      expect(body).toContain('값이 변하기 시작하기 전부터 다 변한 뒤까지를 통째로 담습니다')
      expect(body).toContain('| 시작 전 가만히 둘 시간 | 2초 |')
      expect(body).not.toContain('조건을 바꾼 뒤 기다릴 시간')
      expect(body).not.toContain('조건 순서를 적어 둔 차례대로')
    },
  )

  /**
   * 실행 계획이 "8회", 분석 절이 "3회 반복"을 시키던 때에는 학생이 어느 쪽을
   * 따라야 하는지 알 수 없었습니다. 두 절이 같은 수를 말하는지 고정합니다.
   */
  it('repeats a transient run as many times as the analysis section asks for', () => {
    const body = recipe('pendulum').body
    expect(body).toContain('| 조건마다 반복 | 3회 |')
    expect(body).toContain('길이별로 3회 반복')
    expect(body).not.toContain('독립 시행')
  })

  const executionBody = (body: string) =>
    /### 4-\d+\. 실험 실행 계획\n\n([\s\S]*?)(?=\n### |\n<!--|$)/.exec(body)?.[1]

  /** 중2가 한 번 읽어 아는 말만 씁니다. */
  it('keeps the transient plan free of words a 중학생 has to look up', () => {
    for (const id of ['pendulum', 'p1-pendulum-period', 'ph21-rc-time-constant']) {
      const plan = executionBody(recipe(id).body)
      expect(plan, id).toBeDefined()
      for (const word of ['과도', '파형', '적분값', '시간상수', '후처리', '정상 상태']) {
        expect(plan, `${id} → ${word}`).not.toContain(word)
      }
    }
  })

  /**
   * 같은 계획을 진자와 함께 냉각 곡선·충전 곡선도 받습니다. 식어 가는 물이나
   * 충전되는 커패시터는 움직이지 않으므로, 움직임으로 적으면 학생은 자기가
   * 하는 실험을 알아보지 못합니다.
   */
  it('does not call a cooling or charging curve a movement', () => {
    for (const id of ['cooling-curve', 'ph21-rc-time-constant']) {
      const plan = executionBody(recipe(id).body)
      expect(plan, id).toBeDefined()
      expect(plan, id).not.toContain('움직')
    }
  })

  it('uses an event plan for interrupt-triggered measurements', () => {
    const body = recipe('s11-tsl2591-interrupt').body
    expect(body).toContain('사건이 발생한 시점과 센서 응답')
    expect(body).not.toContain('바꿔 가며 잴 조건')
  })

  it('uses a continuous plan for time-series measurements', () => {
    const body = recipe('ph33-light-source-stability').body
    expect(body).toContain('끊김 없는 연속 기록')
    expect(body).not.toContain('조건마다 반복')
  })

  // ph06(용수철 진동)은 여기서 뺐습니다: 진동 파형을 기록하는 실험이라 조건표가
  // 아니라 과도 기록 계획(transient)을 받아야 합니다. 조건표를 주면 1초 간격
  // 표집 지시가 0.9초 주기와 모순됩니다(레시피 검증에서 확인된 결함).
  it('keeps structured conditions and repeats for condition comparisons', () => {
    for (const id of ['ph02-newton-second-law', 'ph17-ohms-law', 'ph24-solenoid-current-field']) {
      const body = recipe(id).body
      expect(body, id).toContain('바꿔 가며 잴 조건')
      expect(body, id).toContain('조건마다 반복')
      expect(body, id).toContain('조건을 바꾼 뒤 기다릴 시간')
    }
  })

  /**
   * 실행 계획이 조건 수를 지어내면 변인 설계와 어긋납니다. "단열재 종류
   * 3~4가지"라고 적어 둔 탐구에 "최솟값과 최댓값 사이를 5단계로 등분하라"는
   * 지시가 나가면, 재료 종류는 등분할 수 있는 것이 아니므로 학생은 여기서
   * 멈춥니다. 조건은 변인 설계에 적힌 문장을 그대로 옮겨 씁니다.
   */
  it('never invents a condition count that contradicts the variable design', () => {
    for (const entry of allRecipes) {
      const plan = inquiryPlans[entry.id]
      if (!entry.body.includes('바꿔 가며 잴 조건')) continue
      expect(entry.body, entry.id).toContain(`| 바꿔 가며 잴 조건 | ${plan.variables.independent} |`)
      expect(entry.body, entry.id).not.toMatch(/독립 변인의 최솟값과 최댓값/)
      expect(entry.body, entry.id).not.toMatch(/단계로 등분/)
      expect(entry.body, entry.id).not.toMatch(/개 조건 묶음/)
    }
  })

  /**
   * 냉각 곡선처럼 조건 하나가 그 자체로 변해 가는 탐구에서는 "값이 안정되면
   * 30개를 저장"할 수 없습니다. 값이 끝내 안정되지 않고, 변해 가는 모양이 곧
   * 답이기 때문입니다. 그대로 따라 하면 40초짜리 자료로 냉각 상수를 구하게 됩니다.
   */
  it('tells curve experiments to record the whole change instead of a fixed sample count', () => {
    for (const entry of allRecipes) {
      if (inquiryPlans[entry.id]?.recording !== 'curve') continue
      expect(entry.body, entry.id).toContain('조건마다 기록할 구간')
      expect(entry.body, entry.id).toContain('끊지 말고 저장')
      expect(entry.body, entry.id).not.toMatch(/조건마다 저장할 표본 수/)
      expect(entry.body, entry.id).not.toMatch(/조건을 바꾼 뒤 \d+초 기다려/)
    }
  })

  it('records a cooling curve for the insulation comparison', () => {
    expect(recipe('ph14-insulation-performance').body).toContain('조건마다 기록할 구간')
  })

  it('states that p1 and p2 calculations happen after raw CSV logging', () => {
    expect(recipe('p1-pendulum-period').body).toContain('원시값만 CSV로 기록')
    expect(recipe('p1-pendulum-period').body).toContain('주기 계산은 저장한 CSV를 후처리')
    // p2는 가속도 적분(자유 진동에서는 불가능)이 아니라 최하점 g_norm 봉우리로
    // 속력을 구하는 방식으로 재설계되었습니다. 원시 기록 후처리라는 원칙은 같습니다.
    expect(recipe('p2-mechanical-energy').body).toContain('g_norm)를 CSV로 기록')
    expect(recipe('p2-mechanical-energy').body).toContain('g_norm 봉우리에서 속력')
  })
})

describe('inquiry plan coverage', () => {
  it('authors a plan for every published recipe', () => {
    const missing = allRecipes.filter((entry) => !inquiryPlans[entry.id]).map((entry) => entry.id)
    expect(missing).toEqual([])
  })

  it('does not carry plans for recipes that no longer exist', () => {
    const ids = new Set(allRecipes.map((entry) => entry.id))
    expect(Object.keys(inquiryPlans).filter((id) => !ids.has(id))).toEqual([])
  })

  it('fills every field a student reads, with a three-step extension ladder', () => {
    for (const [id, plan] of Object.entries(inquiryPlans)) {
      expect(plan.question.trim(), id).not.toBe('')
      expect(plan.question, id).toMatch(/\?$/)
      expect(plan.concepts.length, id).toBeGreaterThanOrEqual(2)
      expect(plan.variables.controls.length, id).toBeGreaterThanOrEqual(3)
      expect(plan.analysis.length, id).toBeGreaterThanOrEqual(3)
      expect(plan.checkpoints.length, id).toBeGreaterThanOrEqual(2)
      for (const step of [plan.extensions.immediate, plan.extensions.broaden, plan.extensions.connect]) {
        expect(step.trim(), id).not.toBe('')
      }
    }
  })

  /**
   * 탐구가 서툰 학생은 "장치를 설치합니다" 같은 문장 앞에서 멈춥니다. 조립
   * 단계는 눈에 보이는 물건을 이름으로 부르고 한 줄에 한 동작만 담아야 합니다.
   */
  it('gives every recipe concrete, one-action setup steps', () => {
    for (const [id, plan] of Object.entries(inquiryPlans)) {
      expect(plan.setup.length, id).toBeGreaterThanOrEqual(4)
      for (const step of plan.setup) {
        expect(step, `${id}: ${step}`).toMatch(/(다|요)[.!?]$/)
        expect(step.length, `${id}: ${step}`).toBeGreaterThan(12)
        const sentences = step.split(/(?<=[다요][.!?])\s+/)
        // 첫 문장이 체크 상자를 받는 동작입니다. 그것이 사실 문장이면 학생은
        // 무엇을 해야 하는지 알 수 없습니다. 뒤따르는 문장은 이유이므로 괜찮습니다.
        expect(isStatement(sentences[0]), `${id}: ${sentences[0]}`).toBe(false)
        // 한 줄에 동작을 여럿 몰아넣으면 따라 하다 한 가지를 빠뜨립니다.
        expect(sentences.length, `${id}: ${step}`).toBeLessThanOrEqual(2)
      }
    }
  })

  /** 돌려쓴 빈말은 어느 레시피에서도 그대로 쓸 수 있어 티가 나지 않습니다. */
  it('does not reuse the same setup sentence across unrelated recipes', () => {
    const seen = new Map<string, string[]>()
    for (const [id, plan] of Object.entries(inquiryPlans)) {
      for (const step of plan.setup) {
        // 어느 레시피에서나 똑같은 마무리 동작은 되풀이돼도 됩니다.
        if (/USB 케이블을 연결하고|배선하기\*\*를 끝까지 마친 뒤/.test(step)) continue
        seen.set(step, [...(seen.get(step) ?? []), id])
      }
    }
    const shared = [...seen].filter(([, ids]) => ids.length > 3)
    expect(shared.map(([step, ids]) => `${step} → ${ids.join(', ')}`)).toEqual([])
  })

  it('references only concepts that exist in the dictionary', () => {
    for (const [id, plan] of Object.entries(inquiryPlans)) {
      for (const conceptId of plan.concepts) {
        expect(concepts[conceptId], `${id} → ${conceptId}`).toBeDefined()
      }
    }
  })

  it('explains every symbol that appears in an authored formula', () => {
    for (const [id, plan] of Object.entries(inquiryPlans)) {
      if (!plan.formula) continue
      expect(plan.formula.symbols.length, id).toBeGreaterThan(0)
      expect(plan.formula.prediction.trim(), id).not.toBe('')
      expect(plan.formula.expression, id).toMatch(/\$/)
    }
  })
})

describe('rendered guide structure', () => {
  it('numbers sections consecutively so no step looks skipped', () => {
    for (const entry of allRecipes) {
      const design = numberedHeadings(entry.body, 4)
      const measure = numberedHeadings(entry.body, 5)
      expect(design.length + measure.length, entry.id).toBeGreaterThanOrEqual(6)
      // 두 단계가 저마다 1부터 끊김 없이 셉니다. 한 화면 안에서 번호가 건너뛰면
      // 학생은 자기가 절을 하나 지나쳤다고 봅니다.
      for (const headings of [design, measure]) {
        expect(headings.map((heading) => heading.index), entry.id)
          .toEqual(headings.map((_, index) => index + 1))
      }
    }
  })

  it('puts the theory before the measurement plan on every recipe', () => {
    for (const entry of allRecipes) {
      const design = numberedHeadings(entry.body, 4).map((heading) => heading.title)
      const measure = numberedHeadings(entry.body, 5).map((heading) => heading.title)
      expect(design[0], entry.id).toBe('과학 이론 쉽게 이해하기')
      expect(design[1], entry.id).toBe('변인 설계')
      expect(design.indexOf('실험 실행 계획'), entry.id).toBeGreaterThan(design.indexOf('변인 설계'))
      // 다음 탐구로 가는 사다리는 결과를 손에 쥔 뒤에 옵니다.
      expect(measure.at(-1), entry.id).toBe('더 나아가기')
    }
  })

  /**
   * 장치를 놓는 일이 재는 일보다 먼저 나와야 합니다. 실행 계획이 앞에 있던
   * 때에는 그 절의 첫 체크 상자가 "전원을 넣고 60초간 예비 관찰"인데 스탠드를
   * 세우고 진자를 매다는 일은 그다음 절이라, 위에서부터 상자를 누르는 학생이
   * 아직 장치가 없는 채로 60초를 기다렸습니다. 몇 번 반복할지 먼저 정하라는
   * 뜻은 순서가 아니라 탐구 순서 절의 머리말이 지킵니다.
   */
  it('sets the apparatus up before it tells the student to start measuring', () => {
    for (const entry of allRecipes) {
      const titles = numberedHeadings(entry.body).map((heading) => heading.title)
      const procedure = titles.indexOf('탐구 순서')
      if (procedure === -1) continue
      expect(titles.indexOf('실험 실행 계획'), entry.id).toBeGreaterThan(procedure)
    }
  })

  /**
   * 체크 상자는 손으로 할 일에만 답니다. "봉우리 수의 절반이 주기 수입니다"
   * 같은 설명에 상자가 붙으면 무엇을 해야 끝나는지 알 수 없습니다. 설명은
   * 번호를 받지 않고 바로 앞 단계의 딸림 줄로 내려갑니다.
   */
  // `m` 없이 씁니다. `$`가 줄 끝을 뜻하면 제목 바로 아래 빈 줄에서 멈춰
  // 본문을 하나도 담지 못합니다.
  const procedureBody = (body: string) =>
    /### 4-\d+\. 탐구 순서\n\n([\s\S]*?)(?=\n### |\n:::|$)/.exec(body)?.[1]

  it('checkboxes only the sentences that tell the student to do something', () => {
    for (const entry of allRecipes) {
      const section = procedureBody(entry.body)
      if (!section) continue
      const boxed = [...section.matchAll(/^\d+\. \[ \] (.+)$/gm)].map((match) => match[1])
      expect(boxed.length, entry.id).toBeGreaterThan(0)
      for (const step of boxed) {
        // 판정은 운영 코드와 같은 함수로 합니다. 검사가 따로 규칙을 들고 있으면
        // `붙입니다`처럼 어간이 `-이다`인 동사를 서로 다르게 읽습니다.
        expect(isStatement(step), `${entry.id}: ${step}`).toBe(false)
      }
    }
  })

  it('demotes an explanation to a sub-note under the step it belongs to', () => {
    const p1 = procedureBody(recipe('p1-pendulum-period').body)!
    expect(p1).toMatch(/^\d+\. \[ \] .*기록하세요\.$/m)
    expect(p1).toContain('   - 봉우리는 추가 최하점을 지날 때마다(반주기마다) 생기므로 봉우리 수의 절반이 주기 수입니다.')

    const p4 = procedureBody(recipe('p4-friction-energy-loss').body)!
    expect(p4).toContain('   - 경사면 위에서는 센서가 중력 성분을 함께 읽어 어긋나는 것이 정상입니다.')
  })

  /** `…합니다.`로 지시하는 레시피가 통째로 딸림 줄로 밀려나면 안 됩니다. */
  it('keeps the -합니다 style recipes as numbered steps', () => {
    const plantGrowth = procedureBody(recipe('plant-growth').body)!
    // 조립 단계에 이어 레시피가 쓴 측정 방법이 한 줄기 번호로 붙습니다.
    expect(plantGrowth).toMatch(/^1\. \[ \] 화분을/m)
    expect(plantGrowth).toMatch(/^\d+\. \[ \] 매일 같은 시각에 생장 지표를/m)
  })

  /**
   * 앞 단계를 더 짧게 되풀이하기만 하는 문장은 버리고, 되풀이처럼 보여도 새 지시가
   * 붙은 문장은 남깁니다. 같은 말을 두 번 읽는 것보다 할 일을 못 보는 쪽이 나쁩니다.
   */
  it('drops a step that only restates an earlier one, but keeps one that adds an instruction', () => {
    const plantGrowth = procedureBody(recipe('plant-growth').body)!
    expect(plantGrowth).not.toContain('센서를 잎에 가려지지 않고 물이 닿지 않는 위치에 고정합니다.')

    const p1 = procedureBody(recipe('p1-pendulum-period').body)!
    expect(p1).toContain('진폭을 10° 이하로 맞추고')
  })

  /** 화면의 "3. 코드 넣기"가 이미 시킨 일을 탐구 순서가 다시 시키지 않습니다. */
  it('never repeats the upload-and-open-the-monitor step the code section already gave', () => {
    for (const entry of allRecipes) {
      const section = procedureBody(entry.body)
      if (!section) continue
      expect(section, entry.id).not.toMatch(/^\d+\. \[ \] USB 케이블을 연결하고 시리얼 모니터를 \d+ baud로 엽니다\.$/m)
    }
  })

  it('lists the controlled variables one per line instead of packing them into a cell', () => {
    for (const entry of allRecipes) {
      expect(entry.body, entry.id).toContain('**통제 변인(끝까지 같게 유지할 것)**')
      expect(entry.body, entry.id).not.toMatch(/통제 변인[^\n]*\|\s*1\)/)
    }
  })

  /**
   * 레시피 원문의 '데이터 처리' 한 줄과 탐구 설계의 계산 단계는 같은 계산을
   * 가리킵니다. 둘을 그냥 이어 붙이면 학생은 방금 한 일을 알아보지 못한 채
   * 기호가 잔뜩 붙은 문장을 또 만나 "이건 뭘 더 하라는 거지"에서 멈춥니다.
   */
  it('does not repeat a calculation step it already spelled out', () => {
    const analysisBody = (body: string) =>
      /## \d+\. 데이터 처리와 그래프\n\n([\s\S]*?)(?=\n## |\n:::|$)/.exec(body)?.[1]
    for (const entry of allRecipes) {
      const section = analysisBody(entry.body)
      if (!section) continue
      const steps = [...section.matchAll(/^\d+\. \[ \] (.+)$/gm)].map((match) => match[1])
      const designed = inquiryPlans[entry.id].analysis
      // 설계가 쓴 단계 뒤에 붙는 것이 레시피 원문에서 온 문장입니다. 설계 단계
      // 끼리는 서로 닮아도 됩니다. "점등 시간"과 "불필요한 점등 시간"처럼
      // 말이 겹칠 뿐 실제로 다른 계산인 경우가 있습니다.
      for (const carried of steps.slice(designed.length)) {
        for (const step of designed) {
          expect(similarity(step, carried), `${entry.id}\n  ${step}\n  ${carried}`)
            .toBeLessThanOrEqual(RESTATEMENT_THRESHOLD)
        }
      }
    }
  })

  /** 실제로 겹쳐 있던 자리들. 원문 쪽 문장이 사라졌는지 눈으로 고정합니다. */
  it('drops the terse restatement that used to follow the plain steps', () => {
    expect(recipe('ph17-ohms-law').body).toContain('기울기 또는 각 점의 $V/I$로 저항을 구해 부품 표시값과 비교합니다.')
    expect(recipe('ph17-ohms-law').body).not.toContain('각 직선의 V/I 또는 기울기에서 저항을 구해 표시값과 비교합니다.')
    expect(recipe('ph14-insulation-performance').body).not.toContain('기울기로 냉각상수를 구해 단열 성능을 비교합니다.')
    // 원문에만 있는 내용은 남습니다. 센서가 얼마나 잘게 구별하는지는 설계 쪽
    // 계산 단계 어디에도 없으므로 지우면 학생이 알 길이 없습니다.
    expect(recipe('p9-motion-interrupt').body).toContain('time_us는 마이크로초 단위입니다.')
    expect(recipe('ph33-light-source-stability').body).toContain('전원 주파수의 빠른 깜빡임(플리커)은 평균되어 보이지 않으며')
  })

  it('describes exactly the CSV columns the sketch actually prints', () => {
    for (const entry of allRecipes) {
      const header = findCsvHeader(entry.sketch)
      expect(header, entry.id).not.toBeNull()
      for (const column of header!.split(',')) {
        expect(entry.body, `${entry.id} → ${column}`).toContain(`\`${column}\``)
      }
    }
  })

  it('never leaves a grammatical placeholder in student-facing text', () => {
    for (const entry of allRecipes) {
      expect(entry.body, entry.id).not.toMatch(/[은이을과]\([는가를와]\)/)
      expect(entry.body, entry.id).not.toContain('undefined')
    }
  })

  it('is idempotent so a re-run cannot stack two guides', () => {
    for (const entry of allRecipes) {
      expect(entry.body.match(/## 한눈에 보기/g)?.length, entry.id).toBe(1)
    }
  })

  /**
   * 카나리 레시피는 학생 화면에 실제로 보이는 동시에 검증 파이프라인의 기준
   * 표본입니다. 가이드를 붙이면서 스케치까지 바꾸면 기록해 둔 verifyHash가
   * 어긋나므로(그 확인은 `canary.test.ts`가 맡습니다), 여기서는 스케치가 손대지
   * 않은 원본 그대로인지를 고정합니다.
   */
  it('adds a guide to the canary recipes without reformatting their verified sketches', () => {
    for (const entry of canaryRecipes) {
      expect(entry.body, entry.id).toContain('## 한눈에 보기')
      expect(entry.status, entry.id).toBe('published')
      expect(entry.sketch, entry.id).not.toBe(formatArduinoCode(entry.sketch))
    }
  })
})

describe('화면이 나눠 그릴 수 있게 자른 가이드', () => {
  /**
   * 요약은 허브, 설계는 4단계, 측정은 5단계 화면으로 갑니다. 재기 전에 정하는 것과
   * 재고 나서 하는 것이 한 덩어리로 있던 때에는, 한 번도 재보기 전에 '데이터
   * 처리와 그래프'를 읽었습니다.
   */
  it('모든 레시피가 요약·설계·측정 세 자리로 갈린다', () => {
    for (const entry of allRecipes) {
      const { overview, design, measure } = splitGuide(entry.body)
      expect(overview, entry.id).toContain('이 탐구가 답하려는 질문')
      expect(overview, entry.id).not.toContain('## 한눈에 보기')
      expect(design, entry.id).toMatch(/^### 4-1\. /)
      expect(measure, entry.id).toMatch(/^### 5-1\. /)
      // 재고 나서 하는 절이 설계 쪽에 남아 있으면 안 됩니다.
      expect(design, entry.id).not.toContain('데이터 처리와 그래프')
      expect(measure, entry.id).not.toContain('변인 설계')
    }
  })

  /**
   * 안전 안내는 배선을 시작하기 전에 화면이 이미 보여 줍니다. 본문에는 한 벌만
   * 남겨 두어 `safetyNotice`가 계속 찾아 쓰게 하고, 가이드에서는 빼냅니다.
   */
  it('안전 안내를 본문에는 남기고 가이드에서는 뺀다', () => {
    const withSafety = allRecipes.filter((entry) => entry.body.includes(':::callout warn'))
    expect(withSafety.length).toBeGreaterThan(100)
    for (const entry of withSafety) {
      expect(entry.body.match(/:::callout warn/g)!.length, entry.id).toBe(1)
      const { overview, design, measure } = splitGuide(entry.body)
      for (const part of [overview, design, measure]) {
        expect(part, entry.id).not.toContain(':::callout')
        expect(part, entry.id).not.toContain('안전 점검')
      }
    }
  })

  it('요약표에서 이 탐구가 답하려는 질문을 꺼내고, 그 질문이 레시피마다 다르다', () => {
    const questions = allRecipes.map((entry) => inquiryQuestion(entry.body))
    for (const [index, question] of questions.entries()) {
      expect(question, allRecipes[index].id).toMatch(/\?$/)
    }
    expect(new Set(questions).size).toBe(questions.length)
  })
})

describe('실행 계획이 스케치와 어긋나지 않는다', () => {
  /**
   * 예전에는 표본 간격을 센서 종류만 보고 정해, 10 ms마다 한 줄을 찍는 스케치에도
   * "표본 간격 1초"라고 적었습니다. 111개 중 39개가 그랬습니다.
   */
  it('표본 간격을 스케치가 실제로 쉬는 시간에서 읽는다', () => {
    const ina219 = recipe('ina219-current')
    expect(/samplingIntervalMs\s*=\s*50/.test(ina219.sketch)).toBe(true)
    expect(ina219.body).toContain('| 표본 간격 | 50밀리초 |')

    const bme = recipe('S6')
    expect(bme.body).toMatch(/\| 표본 간격 \| \d+(?:\.\d+)?초 \|/)
  })

  /**
   * 스케치가 `for (int pwm = 0; pwm <= 255; pwm += 51)`로 조건을 스스로 훑는
   * 레시피에 "조건을 바꾼 뒤 기다렸다가 저장하라"고 시키면, 학생에게는 손으로
   * 바꿀 조건이 없어 그 자리에서 멈춥니다.
   */
  it('코드가 조건을 훑는 레시피에는 사람이 할 일만 남긴다', () => {
    for (const id of ['a1-led-brightness', 'a3-servo-angle']) {
      const entry = recipe(id)
      expect(entry.body, id).toContain('조건을 바꾸는 쪽 | 스케치 (사람이 바꾸지 않습니다)')
      expect(entry.body, id).not.toContain('조건을 바꾼 뒤')
      expect(entry.body, id).toContain('한 바퀴의 단계 수')
      // 더 천천히 훑고 싶을 때 고칠 자리를 코드에서 그대로 가리킵니다.
      expect(entry.body, id).toContain(entry.tunables[0].anchor)
    }
  })

  it('손으로 조건을 바꾸는 레시피는 그대로 조건표 계획을 받는다', () => {
    expect(recipe('p8-inverse-square-light').body).toContain('조건을 바꾼 뒤')
  })
})

/**
 * 분석 절은 "길이별로 3회 반복해 평균을 구하라"고 시키지만, 첫 조건을 재고
 * 그래프를 본 학생에게는 두 번째 조건으로 돌아가는 길이 어디에도 없었습니다.
 */
describe('한 조건을 다 잰 뒤 다음 조건으로 가는 길', () => {
  it('측정 쪽에 화면의 단추 이름으로 되풀이하는 법을 적는다', () => {
    const { measure, design } = splitGuide(recipe('pendulum').body)
    expect(measure).toContain('조건을 바꿔 다시 재기')
    expect(measure).toContain('2회차로 추가하기')
    expect(measure).toContain('멈추고 회차로 넣기')
    expect(measure).toContain('열 더하기')
    expect(measure).toContain('실의 길이 20~80 cm를 5단계')
    // 재기 전에 읽는 설계 쪽이 아니라 그래프를 본 뒤에 읽는 자리에 둡니다.
    expect(design).not.toContain('조건을 바꿔 다시 재기')
  })

  it('데이터 처리와 그래프를 읽은 다음에 나온다', () => {
    const { measure } = splitGuide(recipe('p8-inverse-square-light').body)
    expect(measure.indexOf('조건을 바꿔 다시 재기'))
      .toBeGreaterThan(measure.indexOf('데이터 처리와 그래프'))
  })

  /** 코드가 조건을 훑는 레시피에는 학생이 손으로 바꿀 조건이 없습니다. */
  it('코드가 조건을 훑는 레시피에는 내지 않는다', () => {
    for (const id of ['a1-led-brightness', 'a3-servo-angle']) {
      expect(recipe(id).body, id).not.toContain('조건을 바꿔 다시 재기')
    }
  })

  /** 이어서 기록하기만 하는 탐구에는 바꿀 조건이 없습니다. */
  it('연속 기록과 사건 기록 탐구에는 내지 않는다', () => {
    expect(recipe('ph33-light-source-stability').body).not.toContain('조건을 바꿔 다시 재기')
    expect(recipe('s11-tsl2591-interrupt').body).not.toContain('조건을 바꿔 다시 재기')
  })
})

/**
 * 준비물 화면은 배선에서 부품을 끌어냅니다. 그래서 진자의 실·추·스탠드처럼
 * 전선에 걸리지 않는 물건은 목록에 없었고, 학생은 탐구 순서까지 읽고 나서야
 * 무엇이 더 필요한지 알게 되었습니다.
 */
describe('전자 부품 밖의 준비물', () => {
  it('탐구 설계가 적어 둔 목록을 요약에 심고 준비물 화면이 그대로 읽는다', () => {
    const body = recipe('pendulum').body
    // 요약 화면의 `<h2>` 바로 아래에 놓이므로 제목 단계는 `###`입니다. `####`는
    // h2 다음에 h4가 되어 접근성 검사(heading-order)가 걸립니다.
    expect(body).toContain('### 전자 부품 밖의 준비물')
    expect(apparatusFor(body)).toEqual(inquiryPlans.pendulum.apparatus)
  })

  it('적어 둔 것이 없는 레시피에서는 빈 목록이다', () => {
    for (const entry of allRecipes) {
      if (inquiryPlans[entry.id]?.apparatus?.length) continue
      expect(apparatusFor(entry.body), entry.id).toEqual([])
    }
  })
})
