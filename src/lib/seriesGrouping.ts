/**
 * 한 열의 값으로 계열을 나눕니다.
 *
 * 센서를 여러 개 단 레시피는 한 행씩 번갈아 출력합니다(`channel`, `index`, `position`).
 * 이런 자료를 시간축에 그대로 그리면 이웃한 점이 서로 다른 센서라서 톱니가 되고,
 * 그래프가 아니라 잡음이 됩니다. 조건을 이름으로 남기는 레시피(`condition_id`)도
 * 마찬가지로 한 덩어리로 그리면 조건이 뒤섞입니다.
 *
 * 나눌 열을 고르면 값마다 계열이 하나씩 생깁니다. 회차는 계열을 나누는 또 다른 축이라
 * 둘을 함께 쓰면 계열 수가 곱으로 늘어 읽을 수 없으므로, 나누기를 쓸 때는 회차를
 * 모두 합쳐 그립니다.
 */

/** 값이 이보다 많은 열은 계열이 아니라 측정값이므로 나누기 기준으로 제안하지 않습니다. */
export const MAX_GROUP_VALUES = 8

export interface GroupCandidate {
  name: string
  /** 이 열에 나타난 서로 다른 값. 숫자면 크기순, 아니면 가나다순입니다. */
  values: string[]
}

function distinctValues(values: readonly string[]): string[] {
  const seen = [...new Set(values.map((value) => value.trim()).filter(Boolean))]
  const allNumeric = seen.every((value) => Number.isFinite(Number(value)))
  return allNumeric
    ? seen.sort((first, second) => Number(first) - Number(second))
    : seen.sort((first, second) => first.localeCompare(second, 'ko-KR'))
}

/**
 * 계열을 나눌 만한 열을 찾습니다. 값이 두 가지 이상이면서 되풀이되는 열만 고릅니다.
 * 행마다 값이 다른 열(시각, 측정값)은 나눠 봤자 점 하나짜리 계열만 잔뜩 생깁니다.
 */
export function collectGroupColumns(header: readonly string[], rows: readonly string[][]): GroupCandidate[] {
  return header
    .map((name, index) => ({ name, values: distinctValues(rows.map((row) => row[index] ?? '')) }))
    .filter((candidate) =>
      candidate.values.length >= 2
      && candidate.values.length <= MAX_GROUP_VALUES
      // 값이 적어도 세 번은 되풀이되어야 계열입니다. 행마다 값이 달라지는 시각·측정값
      // 열까지 제안하면 목록이 길어져 정작 골라야 할 열이 묻힙니다.
      && candidate.values.length * 3 <= rows.length,
    )
}

export interface RowGroup {
  value: string
  rows: string[][]
}

/**
 * 계열을 열로 펼칩니다.
 *
 * 여러 지점의 온도 차처럼 **같은 시각의 두 계열을 빼야** 나오는 값은, 값이 세로로
 * 번갈아 쌓여 있는 한 만들 수 없습니다. 같은 순번끼리 나란히 놓아 열로 바꾸면
 * `temperature_c_0 - temperature_c_1`처럼 보통의 계산 열로 구할 수 있습니다.
 *
 * 짝짓는 기준은 시각이 아니라 **각 계열 안에서의 순번**입니다. 센서를 차례로 읽는
 * 스케치는 같은 한 바퀴 안에서도 시각이 몇 ms씩 어긋나므로, 시각이 같은 것만 묶으면
 * 거의 모든 행이 혼자 남습니다.
 */
export function pivotByColumn(
  header: readonly string[],
  rows: readonly string[][],
  name: string,
): { header: string[]; rows: string[][] } {
  const groups = splitRowsByColumn(header, rows, name)
  if (groups.length < 2) return { header: [...header], rows: rows.map((row) => [...row]) }

  const keptIndexes = header.map((_column, index) => index).filter((index) => header[index] !== name)
  const nextHeader = groups.flatMap((group) => keptIndexes.map((index) => `${header[index]}_${group.value}`))
  const length = Math.min(...groups.map((group) => group.rows.length))

  const nextRows = Array.from({ length }, (_unused, order) =>
    groups.flatMap((group) => keptIndexes.map((index) => group.rows[order][index] ?? '')),
  )

  return { header: nextHeader, rows: nextRows }
}

/** 행을 한 열의 값끼리 모읍니다. 값이 비어 있는 행은 어느 계열에도 넣지 않습니다. */
export function splitRowsByColumn(
  header: readonly string[],
  rows: readonly string[][],
  name: string,
): RowGroup[] {
  const index = header.indexOf(name)
  if (index < 0) return []

  const grouped = new Map<string, string[][]>()
  for (const row of rows) {
    const value = (row[index] ?? '').trim()
    if (!value) continue
    const bucket = grouped.get(value)
    if (bucket) bucket.push([...row])
    else grouped.set(value, [[...row]])
  }

  return distinctValues([...grouped.keys()]).map((value) => ({ value, rows: grouped.get(value) ?? [] }))
}
