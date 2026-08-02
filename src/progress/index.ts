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

/**
 * 탐구 가이드의 체크 목록. 배선 진행도(`WiringProgress`)와 따로 두는 이유는
 * 두 가지입니다. 배선은 단계 수가 `recipe.wiring.length`로 정해져 있어 번호로
 * 셀 수 있지만, 가이드의 항목은 본문을 고칠 때마다 개수와 자리가 바뀝니다.
 * 그래서 번호가 아니라 **항목의 글자 자체**를 열쇠로 씁니다. 문장을 고치면 그
 * 항목의 체크만 풀리고, 순서를 바꾸거나 항목을 더해도 나머지는 그대로입니다.
 */
export const CHECKLIST_VERSION = 1 as const

export function checklistKey(scope: string): string {
  return `arduino-checklist:v${CHECKLIST_VERSION}:${scope}`
}

export type ChecklistState = Record<string, true>

export function loadChecklist(scope: string, storage?: Storage): ChecklistState {
  if (!storage) return {}
  try {
    const raw = storage.getItem(checklistKey(scope))
    if (!raw) return {}
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, checked]) => checked === true)
        .map(([item]) => [item, true as const]),
    )
  } catch {
    return {}
  }
}

export function saveChecklist(scope: string, state: ChecklistState, storage?: Storage): void {
  if (!storage) return
  try {
    storage.setItem(checklistKey(scope), JSON.stringify(state))
  } catch {
    // 사생활 보호 모드와 저장 용량 제한이 가이드를 따라가는 일을 막지 않게 합니다.
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
