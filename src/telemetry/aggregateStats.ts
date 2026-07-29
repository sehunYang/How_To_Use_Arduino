import { StatsSchema, type AnonEvent, type Stats } from '@/schema'

export interface LearningSession {
  completed: boolean
  lastCheckedStep: number | null
}

export interface IncrementalAggregation {
  stats: Map<string, Stats>
  sessions: Map<string, LearningSession>
}

export function sessionKey(recipeId: string, anonId: string): string {
  return `${recipeId}\0${anonId}`
}

function changeDropout(stats: Stats, step: number | null, delta: 1 | -1): void {
  if (step === null) return
  const key = String(step)
  const next = (stats.dropAtStep[key] ?? 0) + delta
  if (next <= 0) delete stats.dropAtStep[key]
  else stats.dropAtStep[key] = next
}

/**
 * Applies only newly-read events to persisted recipe/session state.
 *
 * The caller commits the returned states and its `(at, document-id)` cursor
 * atomically. This makes retries exact: an event is either reflected in both
 * state and cursor, or in neither. Dropout counters are adjusted as a session
 * advances or completes instead of being added again on every daily run.
 */
export function applyEventBatch(
  events: AnonEvent[],
  existingStats: ReadonlyMap<string, Stats>,
  existingSessions: ReadonlyMap<string, LearningSession>,
): IncrementalAggregation {
  const stats = new Map(
    [...existingStats].map(([id, value]) => [id, StatsSchema.parse(structuredClone(value))]),
  )
  const sessions = new Map(
    [...existingSessions].map(([id, value]) => [id, { ...value }]),
  )

  for (const event of events) {
    if (event.event === 'search_fail') continue

    let recipeStats = stats.get(event.recipeId)
    if (!recipeStats) {
      recipeStats = StatsSchema.parse({})
      stats.set(event.recipeId, recipeStats)
    }

    const key = sessionKey(event.recipeId, event.anonId)
    let session = sessions.get(key)
    if (!session) {
      session = { completed: false, lastCheckedStep: null }
      sessions.set(key, session)
      recipeStats.started += 1
    }

    if (event.event === 'step_check' && event.step !== undefined && !session.completed) {
      if (session.lastCheckedStep === null || event.step > session.lastCheckedStep) {
        changeDropout(recipeStats, session.lastCheckedStep, -1)
        session.lastCheckedStep = event.step
        changeDropout(recipeStats, session.lastCheckedStep, 1)
      }
    }

    if (event.event === 'complete' && !session.completed) {
      changeDropout(recipeStats, session.lastCheckedStep, -1)
      session.completed = true
      recipeStats.completed += 1
    }

    if (recipeStats.processedThrough === null || event.at > recipeStats.processedThrough) {
      recipeStats.processedThrough = event.at
    }
  }

  for (const [id, value] of stats) stats.set(id, StatsSchema.parse(value))
  return { stats, sessions }
}
