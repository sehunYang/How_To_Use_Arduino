import type {
  SearchIndexEntry,
  SensorRationale,
  Subject,
} from '@/schema'

export interface AggregatedSensor {
  sensorId: string
  whyText: string
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

    return { sensorId, whyText: rationale.whyText }
  })
}
