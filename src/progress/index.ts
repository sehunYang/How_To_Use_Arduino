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

/**
 * 데이터 화면에 넣어 둔 회차.
 *
 * 회차는 화면 안에만 있었습니다. 레시피로 돌아가 조건을 바꾸고 다시 오면 1회차가
 * 사라져, 학생은 실험을 다시 하거나 붙여넣기를 처음부터 되풀이했습니다. 배선 진행과
 * 같은 저장소에 레시피마다 한 벌씩 둡니다. 한 벌만 두면 다른 레시피의 데이터 화면을
 * 열어 보기만 해도 앞 레시피의 회차가 덮이거나 지워집니다. 메뉴로 들어왔을 때 어느
 * 것을 되살릴지는 "마지막으로 쓴 레시피" 표시 하나로 정합니다.
 */
export const TRIALS_VERSION = 1 as const
const TRIALS_PREFIX = `arduino-trials:v${TRIALS_VERSION}`
/** 레시피 없이 메뉴로 들어와 붙여넣은 회차가 쓰는 자리. */
export const FREE_TRIALS_SCOPE = 'free'
const LATEST_TRIALS_KEY = `${TRIALS_PREFIX}:latest`
/**
 * 한 벌의 글자 수 한계. localStorage는 보통 5 MB이고 브라우저는 글자 하나를 2바이트로
 * 세므로, 배선 진행과 체크 목록이 쓸 자리를 남기려면 이보다 클 수 없습니다.
 */
export const MAX_TRIALS_CHARS = 1_500_000

export function trialsKey(recipeId: string | null): string {
  return `${TRIALS_PREFIX}:${recipeId ?? FREE_TRIALS_SCOPE}`
}

export interface SavedTrial {
  id: number
  label: string
  header: string[]
  rows: string[][]
  manualValues: Record<string, string>
}

export interface SavedTrialsHint {
  expectedHeader: string[] | null
  sensors: string[]
  recipeId?: string
  title?: string
}

export interface SavedTrials {
  version: typeof TRIALS_VERSION
  /** 어느 레시피에서 왔는지. 레시피 없이 열었으면 `null`. */
  recipeId: string | null
  baudRate: number
  /** 레시피 화면이 넘겨 준 기준(열 이름·센서·제목). 주소 없이 메뉴로 들어와도 되살립니다. */
  hint: SavedTrialsHint | null
  trials: SavedTrial[]
  xName: string | null
  yNames: string[]
  manualNames: string[]
  calculatedColumns: Array<{ name: string; expression: string }>
  /** 기본/고급. 고급에서 조건 값 열을 적던 학생이 새로 고침 뒤 입력란을 잃지 않게 합니다. */
  level?: 'basic' | 'advanced'
  updatedAt: string
}

const stringList = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

function readHint(value: unknown): SavedTrialsHint | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const expectedHeader = stringList(raw.expectedHeader)
  return {
    expectedHeader: expectedHeader.length > 0 ? expectedHeader : null,
    sensors: stringList(raw.sensors),
    ...(typeof raw.recipeId === 'string' ? { recipeId: raw.recipeId } : {}),
    ...(typeof raw.title === 'string' ? { title: raw.title } : {}),
  }
}

function readTrial(value: unknown, index: number): SavedTrial | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.id !== 'number' || !Array.isArray(raw.header) || !Array.isArray(raw.rows)) return null
  return {
    id: raw.id,
    label: typeof raw.label === 'string' ? raw.label : `${index + 1}회차`,
    header: stringList(raw.header),
    rows: raw.rows.filter(Array.isArray).map(stringList),
    manualValues: raw.manualValues && typeof raw.manualValues === 'object'
      ? Object.fromEntries(Object.entries(raw.manualValues as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      : {},
  }
}

/** 마지막으로 회차를 저장한 레시피. 메뉴로 들어왔을 때 무엇을 되살릴지 정합니다. */
export function loadLatestTrialsScope(storage?: Storage): string | null {
  try {
    return storage?.getItem(LATEST_TRIALS_KEY) ?? null
  } catch {
    return null
  }
}

export function loadTrials(recipeId: string | null, storage?: Storage): SavedTrials | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(trialsKey(recipeId))
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<SavedTrials>
    if (value.version !== TRIALS_VERSION || !Array.isArray(value.trials)) return null
    return {
      version: TRIALS_VERSION,
      recipeId: typeof value.recipeId === 'string' ? value.recipeId : null,
      baudRate: typeof value.baudRate === 'number' ? value.baudRate : 9600,
      hint: readHint(value.hint),
      trials: value.trials.map(readTrial).filter((trial): trial is SavedTrial => trial !== null),
      xName: typeof value.xName === 'string' ? value.xName : null,
      yNames: stringList(value.yNames),
      manualNames: stringList(value.manualNames),
      calculatedColumns: Array.isArray(value.calculatedColumns)
        ? value.calculatedColumns.filter((column): column is { name: string; expression: string } =>
            !!column && typeof column.name === 'string' && typeof column.expression === 'string')
        : [],
      level: value.level === 'advanced' ? 'advanced' : 'basic',
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : EMPTY_UPDATED_AT,
    }
  } catch {
    return null
  }
}

/**
 * 저장합니다. 너무 커서 들어가지 않으면 옛 사본까지 지우고 `false`를 돌려주어 화면이
 * "이 화면을 떠나면 사라진다"고 알릴 수 있게 합니다. 옛 사본을 남기면 돌아왔을 때
 * 회차 몇 개만 되살아나, 사라졌다는 말도 남았다는 말도 거짓이 됩니다.
 */
export function saveTrials(saved: SavedTrials, storage?: Storage): boolean {
  if (!storage) return false
  const key = trialsKey(saved.recipeId)
  try {
    const raw = JSON.stringify(saved)
    if (raw.length > MAX_TRIALS_CHARS) {
      storage.removeItem(key)
      return false
    }
    storage.setItem(key, raw)
    storage.setItem(LATEST_TRIALS_KEY, saved.recipeId ?? FREE_TRIALS_SCOPE)
    return true
  } catch {
    try {
      storage.removeItem(key)
    } catch {
      // 지우지도 못하는 저장소면 할 수 있는 일이 없습니다.
    }
    return false
  }
}

export function clearTrials(recipeId: string | null, storage?: Storage): void {
  try {
    storage?.removeItem(trialsKey(recipeId))
    if (loadLatestTrialsScope(storage) === (recipeId ?? FREE_TRIALS_SCOPE)) storage?.removeItem(LATEST_TRIALS_KEY)
  } catch {
    // 지우지 못해도 다음 저장이 덮어씁니다.
  }
}
