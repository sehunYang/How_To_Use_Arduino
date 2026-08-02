/**
 * 저항값을 색띠로 옮깁니다.
 *
 * 준비물 목록은 `4.7 kΩ 저항 1개`라고 적어 주지만, 저항을 처음 보는 학생에게
 * 그 문장은 서랍 앞에서 아무 도움이 되지 않습니다. 저항에는 값이 숫자로
 * 인쇄되어 있지 않고 색띠로만 적혀 있어서, 값을 알아도 **어느 것이 그것인지**
 * 고를 수 없기 때문입니다.
 *
 * 색띠는 값에서 계산되는 것이므로 레시피마다 손으로 적지 않습니다. 손으로 적으면
 * 배선의 저항값을 바꿀 때 색만 옛날 값으로 남습니다.
 */

export interface ResistorBand {
  /** 학생이 눈으로 찾을 색 이름 */
  name: string
  /** 화면에 칠할 색 */
  hex: string
  /** 이 띠가 뜻하는 것 */
  meaning: string
}

/** 색띠 표의 0~9. 순서가 곧 숫자이므로 자리를 바꾸면 안 됩니다. */
const DIGIT_COLORS: Array<{ name: string; hex: string }> = [
  { name: '검정', hex: '#111111' },
  { name: '갈색', hex: '#6d4123' },
  { name: '빨강', hex: '#d13b30' },
  { name: '주황', hex: '#e8791b' },
  { name: '노랑', hex: '#f2c313' },
  { name: '초록', hex: '#2f8f4e' },
  { name: '파랑', hex: '#2166c4' },
  { name: '보라', hex: '#7b3fa0' },
  { name: '회색', hex: '#8a8a8a' },
  { name: '흰색', hex: '#f2f2f2' },
]

const GOLD = { name: '금색', hex: '#c9a227' }
const SILVER = { name: '은색', hex: '#b8b8b8' }

/**
 * 값이 10의 자리로 떨어지지 않으면 두 자리 색띠로 적을 수 없습니다. 실제로 쓰는
 * 저항은 모두 두 자리 유효숫자(220, 4700, 10000)라 여기 걸리지 않지만, 새 값이
 * 들어왔을 때 **그럴듯한 거짓 색띠**를 그리는 것보다 아무것도 그리지 않는 편이
 * 낫습니다. 색을 보고 고르는 학생은 그림이 틀렸는지 확인할 방법이 없습니다.
 */
export function resistorBands(ohms: number): ResistorBand[] | null {
  if (!Number.isFinite(ohms) || ohms <= 0) return null

  let exponent = 0
  let mantissa = ohms
  while (mantissa >= 100) {
    mantissa /= 10
    exponent += 1
  }
  while (mantissa < 10) {
    mantissa *= 10
    exponent -= 1
  }
  if (!Number.isInteger(mantissa)) return null
  if (exponent < -2 || exponent > 9) return null

  const first = Math.floor(mantissa / 10)
  const second = mantissa % 10
  const multiplier =
    exponent === -1 ? GOLD : exponent === -2 ? SILVER : DIGIT_COLORS[exponent]
  const multiplierMeaning =
    exponent < 0 ? `×0.${'0'.repeat(-exponent - 1)}1` : `×${10 ** exponent}`

  return [
    { ...DIGIT_COLORS[first], meaning: `첫째 자리 ${first}` },
    { ...DIGIT_COLORS[second], meaning: `둘째 자리 ${second}` },
    { ...multiplier, meaning: `${multiplierMeaning} 배` },
    { ...GOLD, meaning: '오차 ±5%' },
  ]
}

/** 색띠를 글로도 적어 둡니다. 색이 헷갈리거나 화면을 흑백으로 보는 경우를 위해서입니다. */
export function describeBands(bands: readonly ResistorBand[]): string {
  return bands.map((band) => band.name).join(' · ')
}
