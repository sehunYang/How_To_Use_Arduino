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

    if (!rationale) {
      throw new Error(`Missing rationale for displayed sensor "${sensorId}"`)
    }

    return { sensorId, whyText: rationale.whyText, score: 0, recipeCount: subjects.length }
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
      if (!rationale) throw new Error(`Missing rationale for displayed sensor "${sensorId}"`)

      return {
        sensorId,
        whyText: rationale.whyText,
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
