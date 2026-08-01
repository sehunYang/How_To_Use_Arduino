import type {
  SearchIndexEntry,
  SensorRationale,
  Subject,
} from '@/schema'
import type { SearchResult } from '@/search'

export interface AggregatedSensor {
  sensorId: string
  whyText: string
  score: number
  recipeCount: number
}

const INFRASTRUCTURE_SENSOR_WEIGHTS: Readonly<Record<string, number>> = {
  tca9548a: 0.4,
}

function roleWeight(sensorId: string, index: number) {
  return INFRASTRUCTURE_SENSOR_WEIGHTS[sensorId] ?? (index === 0 ? 1 : 0.85)
}

/**
 * Deduplicates sensors across matched recipes while retaining result order.
 * A subject-specific rationale wins; the subject-neutral rationale is the
 * fallback for sensors reused across subjects.
 *
 * 붙일 문구가 없으면 이유 없이 센서만 보여 줍니다. 레시피는 Firestore에서 오므로
 * 앱이 모르는 센서가 나중에 올라올 수 있고, 그때 화면 전체가 사라지면 안 됩니다.
 * 문구가 빠진 곳은 `aggregateSensors.test.ts`의 전수 검사가 빌드 단계에서 잡습니다.
 */
export function aggregateSensors(
  entries: readonly Pick<SearchIndexEntry, 'sensors' | 'subject'>[],
  rationales: readonly SensorRationale[],
): AggregatedSensor[] {
  const subjectsBySensor = new Map<string, Array<Subject | null>>()

  for (const entry of entries) {
    for (const sensorId of entry.sensors) {
      const subjects = subjectsBySensor.get(sensorId)
      if (subjects) {
        if (!subjects.includes(entry.subject)) subjects.push(entry.subject)
      } else {
        subjectsBySensor.set(sensorId, [entry.subject])
      }
    }
  }

  return [...subjectsBySensor].map(([sensorId, subjects]) => {
    const exact = subjects
      .filter((subject): subject is Subject => subject !== null)
      .map((subject) =>
        rationales.find(
          (rationale) =>
            rationale.sensorId === sensorId &&
            rationale.subject === subject,
        ),
      )
      .find((rationale) => rationale !== undefined)
    const rationale =
      exact ??
      rationales.find(
        (candidate) =>
          candidate.sensorId === sensorId && candidate.subject === null,
      )

    return { sensorId, whyText: rationale?.whyText ?? '', score: 0, recipeCount: subjects.length }
  })
}

/**
 * Ranks sensors only from genuinely matched recipes. The score combines each
 * recipe's search relevance, the sensor's role in that recipe, and a modest
 * recurrence bonus when independent relevant recipes recommend the same part.
 * Padding recipes used only to keep the UI populated never contribute.
 */
export function rankSensors(
  results: readonly SearchResult[],
  rationales: readonly SensorRationale[],
): AggregatedSensor[] {
  const candidates = new Map<string, {
    contribution: number
    recipeCount: number
    firstSeen: number
    subjects: Array<Subject | null>
  }>()

  results.filter((result) => result.sensorEligible).forEach((result, resultIndex) => {
    result.entry.sensors.forEach((sensorId, sensorIndex) => {
      const candidate = candidates.get(sensorId) ?? {
        contribution: 0,
        recipeCount: 0,
        firstSeen: resultIndex,
        subjects: [],
      }
      candidate.contribution += result.relevanceScore * roleWeight(sensorId, sensorIndex)
      candidate.recipeCount += 1
      if (!candidate.subjects.includes(result.entry.subject)) {
        candidate.subjects.push(result.entry.subject)
      }
      candidates.set(sensorId, candidate)
    })
  })

  return [...candidates.entries()]
    .map(([sensorId, candidate]) => {
      const exact = candidate.subjects
        .filter((subject): subject is Subject => subject !== null)
        .map((subject) => rationales.find((item) => item.sensorId === sensorId && item.subject === subject))
        .find((item) => item !== undefined)
      const rationale = exact ?? rationales.find((item) => item.sensorId === sensorId && item.subject === null)

      return {
        sensorId,
        whyText: rationale?.whyText ?? '',
        score: candidate.contribution * (1 + 0.15 * (candidate.recipeCount - 1)),
        recipeCount: candidate.recipeCount,
        firstSeen: candidate.firstSeen,
      }
    })
    .sort((a, b) => b.score - a.score || a.firstSeen - b.firstSeen)
    .map((sensor) => ({
      sensorId: sensor.sensorId,
      whyText: sensor.whyText,
      score: sensor.score,
      recipeCount: sensor.recipeCount,
    }))
}
