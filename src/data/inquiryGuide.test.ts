import { describe, expect, it } from 'vitest'
import { phase5Recipes } from '@/data/phase5'
import { phase6Recipes } from '@/data/phase6'

function recipe(id: string) {
  const found = [...phase5Recipes, ...phase6Recipes].find((candidate) => candidate.id === id)
  expect(found, `missing recipe ${id}`).toBeDefined()
  return found!
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
