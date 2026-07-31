import { describe, expect, it } from 'vitest'
import { ina219CurrentRecipe, multiTsl2591Recipe, pendulumRecipe } from '@/data/canary'
import { phase5Recipes } from '@/data/phase5'
import { phase6Recipes } from '@/data/phase6'
import { concepts } from '@/data/inquiry/concepts'
import { findCsvHeader } from '@/data/inquiry/columns'
import { formatArduinoCode } from '@/lib/formatArduinoCode'
import { inquiryPlans } from '@/data/inquiry/plans'

const canaryRecipes = [pendulumRecipe, multiTsl2591Recipe, ina219CurrentRecipe]
const allRecipes = [...canaryRecipes, ...phase5Recipes, ...phase6Recipes]

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
      expect(body).not.toContain('조건 변경 후 안정화')
      expect(body).not.toContain('조건 순서를 **낮음 → 높음**')
    },
  )

  it('uses an event plan for interrupt-triggered measurements', () => {
    const body = recipe('s11-tsl2591-interrupt').body
    expect(body).toContain('사건이 발생한 시점과 센서 응답')
    expect(body).not.toContain('독립 변인 조건 수')
  })

  it('uses a continuous plan for time-series measurements', () => {
    const body = recipe('ph33-light-source-stability').body
    expect(body).toContain('끊김 없는 연속 기록')
    expect(body).not.toContain('조건 간 반복')
  })

  it('keeps structured levels and repeats for condition comparisons', () => {
    for (const id of ['ph06-spring-oscillation', 'ph14-insulation-performance', 'ph17-ohms-law', 'ph24-solenoid-current-field']) {
      const body = recipe(id).body
      expect(body, id).toContain('독립 변인 조건 수')
      expect(body, id).toContain('조건 간 반복')
      expect(body, id).toContain('조건 변경 후 안정화')
    }
  })

  it('states that p1 and p2 calculations happen after raw CSV logging', () => {
    expect(recipe('p1-pendulum-period').body).toContain('원시값만 CSV로 기록')
    expect(recipe('p1-pendulum-period').body).toContain('주기 계산은 저장한 CSV를 후처리')
    expect(recipe('p2-mechanical-energy').body).toContain('원시값만 CSV로 기록')
    expect(recipe('p2-mechanical-energy').body).toContain('에너지 계산은 저장한 CSV를 후처리')
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
