export const PROGRESS_VERSION = 1 as const
const EMPTY_UPDATED_AT = new Date(0).toISOString()

export interface WiringProgress {
  version: typeof PROGRESS_VERSION
  recipeId: string
  checked: boolean[]
  updatedAt: string
}

export function progressKey(recipeId: string): string {
  return `arduino-progress:v${PROGRESS_VERSION}:${recipeId}`
}

export function loadProgress(recipeId: string, stepCount: number, storage?: Storage): WiringProgress {
  const empty = {
    version: PROGRESS_VERSION,
    recipeId,
    checked: Array<boolean>(stepCount).fill(false),
    updatedAt: EMPTY_UPDATED_AT,
  }
  if (!storage) return empty
  try {
    const raw = storage.getItem(progressKey(recipeId))
    if (!raw) return empty
    const value = JSON.parse(raw) as Partial<WiringProgress>
    if (
      value.version !== PROGRESS_VERSION ||
      value.recipeId !== recipeId ||
      !Array.isArray(value.checked)
    ) return empty
    return {
      ...empty,
      checked: Array.from({ length: stepCount }, (_, index) => value.checked?.[index] === true),
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : empty.updatedAt,
    }
  } catch {
    return empty
  }
}

export function saveProgress(progress: WiringProgress, storage?: Storage): void {
  if (!storage) return
  try {
    storage.setItem(progressKey(progress.recipeId), JSON.stringify(progress))
  } catch {
    // Private browsing and storage quotas must not block the wiring workflow.
  }
}

export function loadRecentProgress(recipeIds: string[], storage?: Storage) {
  if (!storage && typeof window !== 'undefined') storage = window.localStorage
  if (!storage) return null
  const candidates = recipeIds
    .map((recipeId) => loadProgress(recipeId, 100, storage))
    .filter((progress) => progress.updatedAt !== EMPTY_UPDATED_AT)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const recent = candidates[0]
  if (!recent) return null
  const firstUnchecked = recent.checked.findIndex((checked) => !checked)
  return {
    recipeId: recent.recipeId,
    activeStep: firstUnchecked < 0 ? Math.max(0, recent.checked.length - 1) : firstUnchecked,
  }
}
