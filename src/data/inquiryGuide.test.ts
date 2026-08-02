import { describe, expect, it } from 'vitest'
import { ina219CurrentRecipe, multiTsl2591Recipe, pendulumRecipe } from '@/data/canary'
import { phase5Recipes } from '@/data/phase5'
import { phase6Recipes } from '@/data/phase6'
import { phase7Recipes } from '@/data/phase7'
import { concepts } from '@/data/inquiry/concepts'
import { findCsvHeader } from '@/data/inquiry/columns'
import { formatArduinoCode } from '@/lib/formatArduinoCode'
import { inquiryPlans } from '@/data/inquiry/plans'
import { RESTATEMENT_THRESHOLD, isStatement, similarity } from '@/data/inquiryGuide'

const canaryRecipes = [pendulumRecipe, multiTsl2591Recipe, ina219CurrentRecipe]
const allRecipes = [...canaryRecipes, ...phase5Recipes, ...phase6Recipes, ...phase7Recipes]

function recipe(id: string) {
  const found = allRecipes.find((candidate) => candidate.id === id)
  expect(found, `missing recipe ${id}`).toBeDefined()
  return found!
}

/** 본문에서 `## N. 제목` 형태의 절 제목만 순서대로 뽑습니다. */
function numberedHeadings(body: string) {
  return [...body.matchAll(/^## (\d+)\. (.+)$/gm)].map((match) => ({
    index: Number(match[1]),
    title: match[2],
  }))
}

describe('inquiry workbook experiment plans', () => {
  it.each(['p1-pendulum-period', 'p2-mechanical-energy', 'ph21-rc-time-constant'])(
    'uses a transient recording plan for %s',
    (id) => {
      const body = recipe(id).body
      expect(body).toContain('한 번의 운동이나 과도 변화 전체 파형')
      expect(body).not.toContain('조건을 바꾼 뒤 기다릴 시간')
      expect(body).not.toContain('조건 순서를 적어 둔 차례대로')
    },
  )

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
  // 아니라 과도 기록 계획(transient)을 받아야 합니다 — 조건표를 주면 1초 간격
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
        if (/USB 케이블을 연결하고|2번 배선하기를 끝까지 마친 뒤/.test(step)) continue
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
      const headings = numberedHeadings(entry.body)
      expect(headings.length, entry.id).toBeGreaterThanOrEqual(6)
      expect(headings.map((heading) => heading.index), entry.id)
        .toEqual(headings.map((_, index) => index + 1))
    }
  })

  it('puts the theory before the measurement plan on every recipe', () => {
    for (const entry of allRecipes) {
      const titles = numberedHeadings(entry.body).map((heading) => heading.title)
      expect(titles[0], entry.id).toBe('과학 이론 쉽게 이해하기')
      expect(titles[1], entry.id).toBe('변인 설계')
      expect(titles.indexOf('실험 실행 계획'), entry.id).toBeGreaterThan(titles.indexOf('변인 설계'))
      expect(titles.at(-1), entry.id).toBe('더 나아가기')
    }
  })

  /** 몇 번 반복할지 정한 다음에 손을 대야 합니다. 반대면 다 재고 나서 부족을 압니다. */
  it('plans the run before it tells the student to start measuring', () => {
    for (const entry of allRecipes) {
      const titles = numberedHeadings(entry.body).map((heading) => heading.title)
      const procedure = titles.indexOf('탐구 순서')
      if (procedure === -1) continue
      expect(titles.indexOf('실험 실행 계획'), entry.id).toBeLessThan(procedure)
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
    /## \d+\. 탐구 순서\n\n([\s\S]*?)(?=\n## |\n:::|$)/.exec(body)?.[1]

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
    // 조립 6단계 + 레시피가 쓴 측정 방법 2단계가 한 줄기 번호로 이어집니다.
    expect([...plantGrowth.matchAll(/^\d+\. \[ \] /gm)].length).toBeGreaterThanOrEqual(8)
    expect(plantGrowth).toMatch(/^1\. \[ \] 화분을/m)
  })

  it('lists the controlled variables one per line instead of packing them into a cell', () => {
    for (const entry of allRecipes) {
      expect(entry.body, entry.id).toContain('**통제 변인 — 끝까지 같게 유지할 것**')
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
      // 끼리는 서로 닮아도 됩니다 — "점등 시간"과 "불필요한 점등 시간"처럼
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
