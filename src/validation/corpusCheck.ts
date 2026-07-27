import type { Recipe, Subject, SensorRationale, StaticIssue } from '@/schema'
import type { Inventory } from './staticCheck'

export type Issue = StaticIssue

/**
 * Corpus-level invariants (plan 1.3 check #9), deliberately kept OUT of
 * validateRecipe() (N2 rationale, plan section 1.3): these invariants are
 * necessarily false for most of a 6-week authoring window (e.g. subject
 * quotas aren't met until the corpus is nearly complete). Running them
 * per-recipe on a daily cron would leave the check permanently red and
 * ignored during exactly the period per-recipe checks matter most. They're
 * meant to run as a separate release-gate pass (`verify:corpus --release`
 * per the plan) instead of the daily per-recipe cron.
 */
export function validateCorpus(
  recipes: Recipe[],
  inventory: Inventory,
  targetDistribution: Partial<Record<Subject, number>>,
  rationales: SensorRationale[],
): Issue[] {
  const issues: Issue[] = []
  const published = recipes.filter((r) => r.status === 'published')

  // 9a: subject distribution should meet (or exceed) the configured target.
  const countBySubject = new Map<Subject, number>()
  for (const recipe of published) {
    if (!recipe.subject) continue
    countBySubject.set(recipe.subject, (countBySubject.get(recipe.subject) ?? 0) + 1)
  }
  for (const [subject, target] of Object.entries(targetDistribution) as [Subject, number][]) {
    const actual = countBySubject.get(subject) ?? 0
    if (actual < target) {
      issues.push({
        code: 'subject-distribution',
        severity: 'error',
        message: `과목 "${subject}"의 게시된 레시피 수가 ${actual}건으로 목표 ${target}건에 미달합니다.`,
      })
    }
  }

  // 9b: every inventory sensor must have >=1 'sensor-example' recipe referencing it.
  const sensorExampleSensorIds = new Set<string>()
  for (const recipe of recipes) {
    if (recipe.type !== 'sensor-example') continue
    for (const sensorId of recipe.sensors) sensorExampleSensorIds.add(sensorId)
  }
  for (const sensor of inventory.sensors) {
    if (!sensorExampleSensorIds.has(sensor.id)) {
      issues.push({
        code: 'sensor-missing-example',
        severity: 'error',
        message: `센서 "${sensor.id}"를 다루는 sensor-example 레시피가 없습니다.`,
      })
    }
  }

  // 9c: every reachable (sensorId, subject) pair needs a non-empty SensorRationale.whyText.
  const reachablePairs = new Set<string>()
  for (const recipe of recipes) {
    if (!recipe.subject) continue
    for (const sensorId of recipe.sensors) {
      reachablePairs.add(`${sensorId}::${recipe.subject}`)
    }
  }
  const rationaleByPair = new Map<string, SensorRationale>()
  for (const rationale of rationales) {
    if (!rationale.subject) continue
    rationaleByPair.set(`${rationale.sensorId}::${rationale.subject}`, rationale)
  }
  for (const pairKey of reachablePairs) {
    const rationale = rationaleByPair.get(pairKey)
    if (!rationale || rationale.whyText.trim().length === 0) {
      const [sensorId, subject] = pairKey.split('::')
      issues.push({
        code: 'missing-rationale',
        severity: 'error',
        message: `센서 "${sensorId}" x 과목 "${subject}" 조합에 대한 SensorRationale.whyText가 없습니다.`,
      })
    }
  }

  return issues
}
