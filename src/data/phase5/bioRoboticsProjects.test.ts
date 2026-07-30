import { describe, expect, it } from 'vitest'
import { RecipeSchema } from '@/schema'
import { sensors } from '@/data/inventory-seed/sensors'
import { actuators } from '@/data/inventory-seed/actuators'
import { resolveTunableAnchor } from '@/validation/manifest'
import { validateRecipe } from '@/validation/staticCheck'
import {
  biologyProjectRecipes,
  bioRoboticsProjectRecipes,
  roboticsProjectRecipes,
} from './bioRoboticsProjects'

const inventory = { sensors, actuators }

describe('Phase 5 biology and engineering/robotics projects', () => {
  it('contains the canonical B1-B4 and R1-R6 project sets', () => {
    expect(biologyProjectRecipes.map((recipe) => recipe.id)).toEqual([
      'plant-growth',
      'night-activity',
      'photosynthesis-light-control',
      'human-activity-meter',
    ])
    expect(roboticsProjectRecipes.map((recipe) => recipe.id)).toEqual([
      'obstacle-avoid-car',
      'light-follow-car',
      'automatic-door',
      'parking-alarm',
      'rpm-meter',
      'smart-lighting',
    ])
    expect(bioRoboticsProjectRecipes).toHaveLength(10)
  })

  it('uses the required subjects and complete project metadata', () => {
    expect(biologyProjectRecipes.every((recipe) => recipe.subject === '생물')).toBe(true)
    expect(roboticsProjectRecipes.every((recipe) => recipe.subject === '공학·로봇')).toBe(true)
    for (const recipe of bioRoboticsProjectRecipes) {
      expect(recipe.type, recipe.id).toBe('project')
      expect(recipe.status, recipe.id).toBe('draft')
      expect(recipe.reviewedOnDevice, recipe.id).toBeNull()
      expect(recipe.commentReviewed, recipe.id).toBeNull()
      expect(recipe.applicationGuide.trim().length, recipe.id).toBeGreaterThan(0)
      expect(recipe.troubleshooting.length, recipe.id).toBeGreaterThanOrEqual(2)
      expect(recipe.body, recipe.id).toContain(':::toggle')
    }
  })

  it('parses all ten complete recipes through the canonical schema', () => {
    for (const recipe of bioRoboticsProjectRecipes) {
      const result = RecipeSchema.safeParse(recipe)
      expect(
        result.success,
        `${recipe.id}: ${JSON.stringify(result.success ? null : result.error.issues)}`,
      ).toBe(true)
    }
  })

  it('passes every publish-mode L1 static check', () => {
    for (const recipe of bioRoboticsProjectRecipes) {
      const errors = validateRecipe(recipe, inventory, 'publish').filter(
        (issue) => issue.severity === 'error',
      )
      expect(errors, `${recipe.id}: ${JSON.stringify(errors)}`).toEqual([])
    }
  })

  it('has one resolvable tunable marker in every sketch', () => {
    for (const recipe of bioRoboticsProjectRecipes) {
      expect(recipe.tunables, recipe.id).toHaveLength(1)
      expect(
        resolveTunableAnchor(recipe.sketch, recipe.tunables[0].anchor),
        recipe.id,
      ).not.toBeNull()
    }
  })

  it('wires the RPM meter analog OUT to A0 and counts threshold edges', () => {
    const rpmMeter = roboticsProjectRecipes.find((recipe) => recipe.id === 'rpm-meter')!

    expect(rpmMeter.wiring).toContainEqual(
      expect.objectContaining({ from: 'HBE0704.OUT', to: 'UNO.A0' }),
    )
    expect(rpmMeter.wiring.some((connection) => connection.from === 'HBE0704.DO')).toBe(false)
    expect(rpmMeter.sketch).toContain('// @pin OUT=A0')
    expect(rpmMeter.sketch).toContain('analogRead(HALL_PIN)')
    expect(rpmMeter.sketch).toContain('magnetThreshold')
    expect(rpmMeter.sketch).toContain('releaseThreshold')
    expect(rpmMeter.sketch).not.toContain('attachInterrupt')
  })

  it('documents critical scientific and safety limits', () => {
    expect(biologyProjectRecipes[0].body).toContain('PAR')
    expect(biologyProjectRecipes[2].body).toContain('PPFD')
    expect(biologyProjectRecipes[3].body).toContain('의료 진단값')
    expect(roboticsProjectRecipes[0].body).toContain('낭떠러지')
    expect(roboticsProjectRecipes[2].body).toContain('실제 자동문')
    expect(roboticsProjectRecipes[3].body).toContain('실제 주차 안전장치')
    expect(roboticsProjectRecipes[5].body).toContain('안전 저전압')
  })
})
