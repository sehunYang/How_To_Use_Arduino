/**
 * 그래프 축 계산. 측정값의 범위를 사람이 읽기 좋은 눈금으로 바꿉니다.
 * 그림 그리는 코드와 떼어 두어 눈금 규칙만 따로 검사할 수 있게 했습니다.
 */

export interface AxisScale {
  min: number
  max: number
  ticks: number[]
}

/** 눈금 간격을 1·2·2.5·5·10 계열의 값으로 맞춰 읽기 쉬운 축을 만듭니다. */
function niceStep(rawStep: number) {
  const exponent = Math.floor(Math.log10(rawStep))
  const base = 10 ** exponent
  const normalized = rawStep / base
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  return step * base
}

/** 부동소수점 계산에서 생기는 0.30000000000000004 같은 꼬리를 정리합니다. */
function tidy(value: number) {
  return Number(value.toPrecision(12))
}

export function createAxisScale(min: number, max: number, targetTicks = 6): AxisScale {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, ticks: [0, 0.5, 1] }

  // 값이 모두 같으면 넓이가 0인 축이 되므로 양옆으로 조금 벌립니다.
  const padding = max === min ? Math.abs(min) * 0.05 || 1 : 0
  const low = min - padding
  const high = max + padding

  const step = niceStep((high - low) / Math.max(1, targetTicks - 1))
  const niceMin = Math.floor(low / step) * step
  const niceMax = Math.ceil(high / step) * step

  const ticks: number[] = []
  for (let value = niceMin; value <= niceMax + step / 1e6; value += step) ticks.push(tidy(value))

  return { min: tidy(niceMin), max: tidy(niceMax), ticks }
}

/**
 * 측정값이 수만 개일 수 있어 `Math.min(...values)` 대신 순회로 구합니다.
 * 값을 인수로 펼치면 개수가 많을 때 호출 한계를 넘습니다.
 */
export function extent(values: readonly number[]) {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const value of values) {
    if (value < min) min = value
    if (value > max) max = value
  }
  return { min, max }
}

/**
 * 글자가 차지할 가로 폭을 어림합니다. 한글은 글자 크기만큼, 알파벳과 숫자는
 * 그 절반 남짓을 차지한다고 보고 설명 상자의 크기를 정합니다.
 */
export function estimateTextWidth(text: string, fontSize: number) {
  let width = 0
  for (const character of text) {
    width += (character.codePointAt(0) ?? 0) > 0x1100 ? fontSize : fontSize * 0.55
  }
  return width
}
