import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { RecipeSchema } from '@/schema'
import { actuators } from '@/data/inventory-seed/actuators'
import { sensors } from '@/data/inventory-seed/sensors'
import { resolveTunableAnchor } from '@/validation/manifest'
import { validateRecipe } from '@/validation/staticCheck'
import { findCsvHeader } from '@/data/inquiry/columns'
import { phase7Recipes } from '.'

const inventory = { sensors, actuators }

/** A 묶음이 다루기로 한 출력 장치. 하나라도 빠지면 그 부품은 다시 예제 없는 부품이 됩니다. */
const coveredActuators = ['led', 'buzzer', 'servo-sg90', 'relay-module', 'dc-motor-driver', 'lcd1602-i2c']

describe('Phase 7 출력 장치 예제', () => {
  it('여섯 개의 예제를 순서대로 담는다', () => {
    expect(phase7Recipes.map((recipe) => recipe.id)).toEqual([
      'a1-led-brightness',
      'a2-buzzer-tone',
      'a3-servo-angle',
      'a4-relay-switch',
      'a5-dc-motor-drive',
      'a6-lcd-display',
    ])
  })

  /**
   * 센서 예제 10건은 모든 센서를 덮었지만 구동장치는 LCD1602가 0건이었습니다.
   * 이 검사는 그 공백이 다시 생기지 않게 막습니다.
   */
  it('재고의 모든 구동장치에 예제를 하나씩 준다', () => {
    const covered = new Set(phase7Recipes.flatMap((recipe) => recipe.actuators))
    for (const id of coveredActuators) {
      expect(covered, id).toContain(id)
    }
  })

  it('스키마와 게시 모드 L1 검사를 모두 통과한다', () => {
    for (const recipe of phase7Recipes) {
      const parsed = RecipeSchema.safeParse(recipe)
      expect(parsed.success, `${recipe.id}: ${JSON.stringify(parsed.success ? null : parsed.error.issues)}`).toBe(true)
      const errors = validateRecipe(recipe, inventory, 'publish').filter((issue) => issue.severity === 'error')
      expect(errors, `${recipe.id}: ${JSON.stringify(errors)}`).toHaveLength(0)
    }
  })

  it('사람 검토 전에는 초안으로 남는다', () => {
    for (const recipe of phase7Recipes) {
      expect(recipe.status, recipe.id).toBe('draft')
      expect(recipe.reviewedOnDevice, recipe.id).toBeNull()
      expect(recipe.commentReviewed, recipe.id).toBeNull()
    }
  })

  it('바꿔 볼 값이 스케치의 실제 표시에 이어진다', () => {
    for (const recipe of phase7Recipes) {
      expect(recipe.tunables.length, recipe.id).toBe(1)
      for (const tunable of recipe.tunables) {
        expect(resolveTunableAnchor(recipe.sketch, tunable.anchor), recipe.id).not.toBeNull()
        // 바꿀 값의 이름에 단위가 없으면 학생은 무엇을 어떤 단위로 고칠지 모릅니다.
        expect(tunable.name, `${recipe.id}: ${tunable.name}`).toMatch(/\(.+\)/)
      }
    }
  })

  it('모든 스케치가 CSV 헤더 한 줄을 먼저 내보낸다', () => {
    for (const recipe of phase7Recipes) {
      const header = findCsvHeader(recipe.sketch)
      expect(header, recipe.id).not.toBeNull()
      for (const column of header!.split(',')) {
        expect(recipe.body, `${recipe.id} → ${column}`).toContain(`\`${column}\``)
      }
    }
  })

  it('레시피마다 생성된 배선 그림을 하나씩 가진다', () => {
    expect(new Set(phase7Recipes.map((recipe) => recipe.imageUrl)).size).toBe(phase7Recipes.length)
    for (const recipe of phase7Recipes) {
      expect(existsSync(`public/${recipe.imageUrl}`), recipe.imageUrl).toBe(true)
    }
  })

  it('레시피마다 이름 붙은 C++ 검사 자리를 가진다', () => {
    const source = readFileSync('logic/phase7.test.cpp', 'utf8')
    for (const label of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']) {
      expect(source, label).toMatch(new RegExp(`TEST_CASE\\("${label} `))
    }
  })

  it('탐구 가이드를 붙여 번호가 이어진 절로 낸다', () => {
    for (const recipe of phase7Recipes) {
      expect(recipe.body, recipe.id).toContain('## 한눈에 보기')
      expect(recipe.body, recipe.id).toContain('## 1. 과학 이론 쉽게 이해하기')
      expect(recipe.body, recipe.id).toMatch(/## \d+\. 탐구 순서/)
      // 센서를 쓰지 않는 예제는 센서 다리 절을 내지 않습니다.
      if (!recipe.sensors.length) {
        expect(recipe.body, recipe.id).not.toContain('### 센서는 무엇을 대신해 주나요')
      }
    }
  })
})
