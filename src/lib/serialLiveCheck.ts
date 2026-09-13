import { findCsvHeader } from '@/data/inquiry/columns'
import { convertSerialTextToCsv, type ExcludedSerialRow } from '@/lib/serialCsv'
import { LIVE_CHECK_LINES, liveReadingSignals, type ReadingSignal } from '@/recipes/firstReading'
import type { Recipe } from '@/schema'

/**
 * 파서에 넣는 줄 수. 값 행 LIVE_CHECK_LINES개에 열 이름 줄과 리셋 직후의 진단 줄 몇 개가 더 옵니다.
 */
export const LIVE_CHECK_WINDOW = LIVE_CHECK_LINES + 10

/**
 * 레시피 화면이 데이터 화면에 넘겨 주는, 받은 값을 견줄 기준.
 * 코드가 찍는 열 이름과 쓰는 센서면 충분합니다. 레시피 전체를 다시 받을 필요가 없습니다.
 */
export interface RecipeHint {
  /** 스케치가 첫 줄에 찍는 열 이름. 코드에서 못 찾았으면 비어 있습니다. */
  expectedHeader: string[] | null
  sensors: string[]
  /** 돌아갈 레시피. 메뉴로 들어왔으면 없습니다. */
  recipeId?: string
  title?: string
}

export interface LiveCheckResult {
  /** 스케치가 스스로 찍은 오류 줄(`# BME280_ERROR` 등). 추측이 아니라 보드가 말한 것입니다. */
  deviceErrors: string[]
  /** 받은 열 이름이 레시피 코드와 다를 때의 문장. 같으면 `null`. */
  headerMismatch: string | null
  /** 이 레시피의 센서가 고장났을 때만 나오는 값이 보이면 그 신호들. */
  signals: ReadingSignal[]
}

export const EMPTY_LIVE_CHECK: LiveCheckResult = { deviceErrors: [], headerMismatch: null, signals: [] }

const DEVICE_ERROR = /ERROR/i

function deviceErrorLines(excludedRows: readonly ExcludedSerialRow[]) {
  return [...new Set(excludedRows.map((row) => row.content.trim()).filter((content) => DEVICE_ERROR.test(content)))]
}

/**
 * 레시피 화면이 데이터 화면 링크에 싣는 것: 시리얼 속도, 코드가 찍는 열 이름, 쓰는 센서.
 * 이 셋이면 데이터 화면이 레시피를 다시 받지 않고도 받은 값을 견줄 수 있습니다.
 */
export function buildAnalysisParams(recipe: Pick<Recipe, 'id' | 'title' | 'baudRate' | 'sketch' | 'sensors'>) {
  const params = new URLSearchParams({ recipe: recipe.id, title: recipe.title, baud: String(recipe.baudRate) })
  const header = findCsvHeader(recipe.sketch)
  if (header) params.set('header', header)
  if (recipe.sensors.length > 0) params.set('sensors', [...new Set(recipe.sensors)].join(','))
  return params.toString()
}

/**
 * 주소의 `?recipe=`·`?title=`·`?header=`·`?sensors=`를 읽습니다. 아무것도 없으면 메뉴로 들어온 것입니다.
 */
export function parseRecipeHint(params: URLSearchParams): RecipeHint | null {
  const header = params.get('header')?.split(',').map((name) => name.trim()).filter(Boolean) ?? []
  const sensors = params.get('sensors')?.split(',').map((name) => name.trim()).filter(Boolean) ?? []
  const recipeId = params.get('recipe')?.trim() || undefined
  const title = params.get('title')?.trim() || undefined
  if (header.length === 0 && sensors.length === 0 && !recipeId) return null
  return {
    expectedHeader: header.length > 0 ? header : null,
    sensors,
    ...(recipeId ? { recipeId } : {}),
    ...(title ? { title } : {}),
  }
}

/**
 * USB로 받은 첫 줄들을 레시피 기준과 견줍니다. 붙여넣기 파서를 써서
 * 진단 줄·깨진 줄을 빼는 규칙이 두 길에서 어긋나지 않게 합니다.
 */
export function checkReceivedLines(hint: RecipeHint | null, lines: readonly string[]): LiveCheckResult {
  const parsed = convertSerialTextToCsv(lines.slice(0, LIVE_CHECK_WINDOW).join('\n'))
  const deviceErrors = deviceErrorLines(parsed.excludedRows)
  if (!parsed.ok || !hint) return { ...EMPTY_LIVE_CHECK, deviceErrors }

  let headerMismatch: string | null = null
  const expected = hint.expectedHeader
  if (expected && (expected.length !== parsed.header.length || expected.some((name, index) => name !== parsed.header[index]))) {
    headerMismatch = `받은 열 이름(${parsed.header.join(', ')})이 이 레시피 코드의 열 이름(${expected.join(', ')})과 다릅니다. 보드에 다른 레시피의 코드가 올라가 있거나, 코드를 고쳐 열이 달라진 것입니다.`
  }

  return {
    deviceErrors,
    headerMismatch,
    signals: headerMismatch ? [] : liveReadingSignals(hint.sensors, parsed.header, parsed.rows),
  }
}

export type SilenceKind = 'nothing' | 'headerOnly' | 'deviceError'

/**
 * 기다릴 만큼 기다렸는데 값 행이 없을 때, 온 것이 무엇인지. 값 행이 하나라도 있으면 `null`.
 * 진단 줄은 파서가 골라내므로, 오류 줄 하나가 열 이름 줄로 오해받는 일이 없습니다.
 */
export function describeSilence(lines: readonly string[]): SilenceKind | null {
  const parsed = convertSerialTextToCsv(lines.slice(0, LIVE_CHECK_WINDOW).join('\n'))
  if (parsed.ok) return null
  if (deviceErrorLines(parsed.excludedRows).length > 0) return 'deviceError'
  const meaningful = lines.filter((line) => line.trim().length > 0).length - parsed.excludedRows.length
  return meaningful <= 0 ? 'nothing' : 'headerOnly'
}
