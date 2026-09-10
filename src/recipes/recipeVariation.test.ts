import { describe, expect, it } from 'vitest'
import { ina219CurrentRecipe, pendulumRecipe } from '@/data/canary'
import { phase5Recipes } from '@/data/phase5'
import { phase6Recipes } from '@/data/phase6'
import { phase7Recipes } from '@/data/phase7'
import { parseManifest } from '@/validation/manifest'
import { pinMapFor } from './pinMap'
import { linkRecipeTitles } from './relatedRecipes'

const allRecipes = [pendulumRecipe, ina219CurrentRecipe, ...phase5Recipes, ...phase6Recipes, ...phase7Recipes]

describe('배선과 코드를 잇는 표', () => {
  it('스케치가 선언한 핀을 그 핀을 꽂는 배선 단계와 짝짓는다', () => {
    const lines = pinMapFor(pendulumRecipe)
    const sda = lines.find((line) => line.pin === 'A4')
    expect(sda).toBeDefined()
    // 배선 3단계가 MPU6050.SDA를 A4에 꽂습니다. 코드는 그 자리를 SDA라고 부릅니다.
    expect(sda!.step).toBe(3)
    expect(sda!.endpoint).toBe('MPU6050.SDA')
    expect(sda!.role).toBe('SDA')
  })

  it('코드가 부르지 않는 전원·접지 핀은 표에 넣지 않는다', () => {
    const pins = pinMapFor(pendulumRecipe).map((line) => line.pin)
    expect(pins).not.toContain('5V')
    expect(pins).not.toContain('GND')
  })

  /** 이름 없이 자리만 선언한 핀(`// @pin A4=A4`)은 부를 이름이 없다고 말해야 합니다. */
  it('선언한 이름이 핀 이름과 같으면 부를 이름이 없다고 표시한다', () => {
    const a1 = phase7Recipes.find((recipe) => recipe.id === 'a1-led-brightness')!
    const lines = pinMapFor(a1)
    expect(lines.find((line) => line.pin === 'A4')!.role).toBeNull()
    expect(lines.find((line) => line.pin === 'D9')!.role).toBe('LED')
  })

  it('핀을 선언한 모든 레시피가 표를 하나 이상 받는다', () => {
    for (const recipe of allRecipes) {
      if (!Object.keys(parseManifest(recipe.sketch).pins).length) continue
      expect(pinMapFor(recipe).length, recipe.id).toBeGreaterThan(0)
    }
  })

  /** 같은 핀이 두 배선 단계에 나와도 표에는 한 줄만 둡니다. */
  it('한 핀을 두 번 싣지 않는다', () => {
    for (const recipe of allRecipes) {
      const pins = pinMapFor(recipe).map((line) => line.pin)
      expect(new Set(pins).size, recipe.id).toBe(pins.length)
    }
  })
})

describe('다음 탐구로 가는 링크', () => {
  const catalog = [
    { id: 'ph06-spring-oscillation', title: '용수철 진동의 주기와 질량' },
    { id: 'pendulum', title: '단진자의 주기 측정하기' },
  ]

  it('따옴표로 적힌 레시피 제목을 그 레시피로 가는 링크로 바꾼다', () => {
    const linked = linkRecipeTitles('“용수철 진동의 주기와 질량” 레시피와 비교하면', catalog, 'pendulum')
    expect(linked).toBe('[용수철 진동의 주기와 질량](/recipes/ph06-spring-oscillation) 레시피와 비교하면')
  })

  it('지금 보고 있는 레시피를 자기 자신으로 보내지 않는다', () => {
    const source = '“단진자의 주기 측정하기”를 먼저 해 보세요'
    expect(linkRecipeTitles(source, catalog, 'pendulum')).toBe(source)
  })

  it('목록에 없는 제목과 따옴표 밖의 글자는 그대로 둔다', () => {
    expect(linkRecipeTitles('“없는 레시피” 용수철 진동의 주기와 질량', catalog, 'x'))
      .toBe('“없는 레시피” 용수철 진동의 주기와 질량')
  })

  it('색인을 아직 받지 못했으면 본문을 건드리지 않는다', () => {
    const source = '“용수철 진동의 주기와 질량” 레시피'
    expect(linkRecipeTitles(source, [], 'pendulum')).toBe(source)
  })

  /**
   * 가이드가 가리키는 다음 탐구는 모두 저장소에 실제로 있는 제목입니다. 하나라도
   * 링크가 되지 않으면 학생은 그 편만 손으로 찾아야 하므로 전수로 확인합니다.
   */
  it('모든 레시피의 “다른 탐구로”가 실제 레시피 링크가 된다', () => {
    const published = allRecipes.map((recipe) => ({ id: recipe.id, title: recipe.title }))
    for (const recipe of allRecipes) {
      const line = /\*\*다른 탐구로\*\*: (.+)/.exec(recipe.body)?.[1]
      expect(line, recipe.id).toBeDefined()
      expect(linkRecipeTitles(line!, published, recipe.id), recipe.id).toContain('](/recipes/')
    }
  })
})
