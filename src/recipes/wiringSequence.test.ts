import { describe, expect, it } from 'vitest'
import { pendulumRecipe } from '@/data/canary'
import { phase5Recipes } from '@/data/phase5'
import { phase6Recipes } from '@/data/phase6'
import { phase7Recipes } from '@/data/phase7'
import { planBreadboardWiring } from '@/wokwi/buildDiagram'
import { breadboardHoleLabel, wiringSequence } from './wiringSequence'

describe('wiringSequence', () => {
  it('브레드보드를 거치는 배선 줄을 선 하나씩 단계로 펼친다', () => {
    const wires = wiringSequence(pendulumRecipe)

    expect(wires.length).toBeGreaterThan(pendulumRecipe.wiring.length)
    const vcc = wires.filter((wire) => wire.recipeStep === 0)
    expect(vcc.length).toBeGreaterThan(1)
    expect(vcc.map((wire) => [wire.part, wire.parts])).toEqual(vcc.map((_, index) => [index + 1, vcc.length]))
    expect(vcc.every((wire) => wire.purpose === pendulumRecipe.wiring[0].text)).toBe(true)
  })

  it('모든 레시피에서 배선도가 쓰는 계획과 같은 선을 같은 순서로 한 번씩 담는다', () => {
    for (const recipe of [...phase5Recipes, ...phase6Recipes, ...phase7Recipes]) {
      const planned = planBreadboardWiring(recipe)
      const wires = wiringSequence(recipe)
      expect(wires.map(({ from, to }) => [from, to]), recipe.id).toEqual(planned.map(({ from, to }) => [from, to]))
    }
  })

  it('손발전기 레시피는 선 하나마다 단계가 하나다', () => {
    const recipe = phase7Recipes.find((candidate) => candidate.id === 'f1-hand-generator-power')!
    const wires = wiringSequence(recipe)

    expect(wires.length).toBeGreaterThanOrEqual(recipe.wiring.length)
    for (const wire of wires) {
      expect(wire.from).not.toBe(wire.to)
      expect(wire.part).toBeLessThanOrEqual(wire.parts)
    }
  })

  it('부품 다리를 브레드보드에 바로 꽂는 단계는 선이 아니라 다리로 표시한다', () => {
    const recipe = phase5Recipes.find((candidate) => candidate.id === 'S4')!
    const legs = wiringSequence(recipe).filter((wire) => wire.kind === 'leg')

    expect(legs.length).toBeGreaterThan(0)
    for (const leg of legs) expect([leg.from, leg.to].some((end) => end.startsWith('BB.'))).toBe(true)
  })
})

describe('breadboardHoleLabel', () => {
  it('전원 줄과 세로 묶음을 찾아갈 수 있는 말로 옮긴다', () => {
    expect(breadboardHoleLabel('BB.tp.5')).toBe('브레드보드 위쪽 빨강(+) 줄 5번 구멍')
    expect(breadboardHoleLabel('BB.bn.1')).toBe('브레드보드 아래쪽 파랑(−) 줄 1번 구멍')
    expect(breadboardHoleLabel('BB.12t.a')).toBe('브레드보드 위쪽 12번 묶음 a칸')
    expect(breadboardHoleLabel('UNO.5V')).toBeNull()
  })
})
