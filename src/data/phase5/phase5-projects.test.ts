import { describe, expect, it } from 'vitest'
import { actuators } from '@/data/inventory-seed/actuators'
import { sensors } from '@/data/inventory-seed/sensors'
import { RecipeSchema } from '@/schema'
import { resolveTunableAnchor } from '@/validation/manifest'
import { validateRecipe } from '@/validation/staticCheck'
import {
  environmentProjectRecipes,
  phase5ProjectRecipes,
  physicsProjectRecipes,
} from './projectRecipes'

const canonicalTitles = [
  '단진자의 주기 측정하기',
  '역학적 에너지 보존 확인하기',
  '자유낙하 가속도 g 구하기',
  '마찰에 의한 에너지 손실 측정',
  '경사면에서의 가속도',
  '자석의 거리에 따른 자기장 감쇠',
  '태양광 패널 각도별 효율',
  '거리에 따른 빛의 세기 (역제곱 법칙)',
  '온습도에 따른 자동 환풍기 제어',
  '발열·흡열 반응의 온도 변화 기록',
  '물의 냉각 곡선 (뉴턴 냉각법칙)',
  '기압 변화로 날씨 관측',
  '위치별 광량 분포 측정',
  '여러 지점 온도 동시 측정',
]

describe('Phase 5 physics and chemistry/environment project recipes', () => {
  it('contains the canonical P1-P8 and E1-E6 set exactly once', () => {
    expect(physicsProjectRecipes).toHaveLength(8)
    expect(environmentProjectRecipes).toHaveLength(6)
    expect(phase5ProjectRecipes.map((recipe) => recipe.title)).toEqual(canonicalTitles)
    expect(new Set(phase5ProjectRecipes.map((recipe) => recipe.id)).size).toBe(14)
  })

  it('all recipes satisfy the Recipe schema and the publish-mode static content checks', () => {
    for (const recipe of phase5ProjectRecipes) {
      const parsed = RecipeSchema.safeParse(recipe)
      expect(parsed.success, `${recipe.id}: ${parsed.success ? '' : parsed.error.message}`).toBe(true)

      const issues = validateRecipe(recipe, { sensors, actuators }, 'publish')
      expect(issues, recipe.id).toEqual([])
    }
  })

  it('keeps tunables anchor-based and includes two-layer science guidance', () => {
    for (const recipe of phase5ProjectRecipes) {
      expect(recipe.tunables).toHaveLength(1)
      expect(resolveTunableAnchor(recipe.sketch, recipe.tunables[0].anchor), recipe.id).not.toBeNull()
      expect(recipe.body, recipe.id).toContain(':::toggle 원리·오차까지 보기')
      expect(recipe.applicationGuide.trim().length, recipe.id).toBeGreaterThan(20)
      expect(recipe.troubleshooting.length, recipe.id).toBeGreaterThanOrEqual(2)
      expect(recipe.reviewedOnDevice, recipe.id).toBeNull()
      expect(recipe.commentReviewed, recipe.id).toBeNull()
    }
  })

  it('preserves the canonical component combinations for the highest-risk recipes', () => {
    const p7 = phase5ProjectRecipes.find((recipe) => recipe.id === 'p7-solar-panel-angle')
    const e5 = phase5ProjectRecipes.find((recipe) => recipe.id === 'e5-spatial-light-map')
    const e6 = phase5ProjectRecipes.find((recipe) => recipe.id === 'e6-multi-point-temperature')

    expect(p7?.sensors).toEqual(['ina219', 'tsl2591'])
    expect(p7?.applicationGuide).toContain('A0·A1')
    expect(p7?.applicationGuide).toContain('TCA9548A')
    expect(e5?.sensors).toEqual(['tca9548a', 'tsl2591'])
    expect(e5?.wiring.filter((step) => /TSL2591_[123]\.SDA/.test(step.from))).toHaveLength(3)
    expect(e6?.wiring.some((step) => step.text.includes('4.7 kΩ 풀업'))).toBe(true)
  })
})
