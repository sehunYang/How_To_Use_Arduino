import { describe, expect, it } from 'vitest'
import { buildColumns, compileExpression, validateColumnName } from '@/lib/derivedColumns'

const HEADER = ['time_ms', 'excess_temperature_c', 'distance_m']
const ROWS = [
  ['0', '55', '0.2'],
  ['1000', '30', '0.4'],
  ['2000', '10', '0.6'],
]

/** 한 행짜리 표에 식을 걸어 값 하나를 얻습니다. */
function evaluateOnce(expression: string, values: Record<string, number | null>) {
  const result = compileExpression(expression, Object.keys(values))
  if (!result.ok) throw new Error(result.error)
  const columns = new Map(Object.entries(values).map(([name, value]) => [name, [value]]))
  return result.compiled.evaluate(columns, 1)[0]
}

/** 열 하나짜리 표에 식을 걸어 열 전체를 얻습니다. */
function evaluateSeries(expression: string, name: string, values: (number | null)[]) {
  const result = compileExpression(expression, [name])
  if (!result.ok) throw new Error(result.error)
  return result.compiled.evaluate(new Map([[name, values]]), values.length)
}

describe('compileExpression', () => {
  it('reads the four operations, powers and parentheses with the usual precedence', () => {
    expect(evaluateOnce('a + b * 2', { a: 1, b: 3 })).toBe(7)
    expect(evaluateOnce('(a + b) * 2', { a: 1, b: 3 })).toBe(8)
    expect(evaluateOnce('a - b - 1', { a: 10, b: 3 })).toBe(6)
    // 거듭제곱은 오른쪽부터 묶습니다.
    expect(evaluateOnce('a ^ 3 ^ 2', { a: 2 })).toBe(512)
    expect(evaluateOnce('-a ^ 2', { a: 3 })).toBe(-9)
  })

  it('reads the functions the recipes ask for', () => {
    expect(evaluateOnce('ln(a)', { a: Math.E })).toBeCloseTo(1)
    expect(evaluateOnce('log(a)', { a: 1000 })).toBeCloseTo(3)
    expect(evaluateOnce('sqrt(a)', { a: 9 })).toBe(3)
    expect(evaluateOnce('abs(a - 10)', { a: 4 })).toBe(6)
  })

  /** 각도기로 잰 값을 그대로 쓸 수 있도록 삼각함수는 도(°)로 계산합니다. */
  it('reads angles in degrees, not radians', () => {
    expect(evaluateOnce('cos(각도_deg)', { 각도_deg: 60 })).toBeCloseTo(0.5)
    expect(evaluateOnce('sin(각도_deg)', { 각도_deg: 30 })).toBeCloseTo(0.5)
    expect(evaluateOnce('cos(각도_deg)^2', { 각도_deg: 45 })).toBeCloseTo(0.5)
    expect(evaluateOnce('asin(acceleration_x_g)', { acceleration_x_g: 0.5 })).toBeCloseTo(30)
    expect(evaluateOnce('tan(asin(acceleration_x_g))', { acceleration_x_g: 0.5 })).toBeCloseTo(0.57735)
  })

  /**
   * 속도(이웃한 두 행의 차이)나 공급 에너지(행을 쌓은 합)는 그 행 하나만 봐서는
   * 만들 수 없습니다. 레시피가 요구하는 계산의 절반이 여기에 걸립니다.
   */
  it('reads the neighbouring rows for a rate, a running total and a moving average', () => {
    expect(evaluateSeries('diff(x)', 'x', [1, 3, 6, 10])).toEqual([null, 2, 3, 4])
    expect(evaluateSeries('prev(x)', 'x', [1, 3, 6])).toEqual([null, 1, 3])
    expect(evaluateSeries('cumsum(x)', 'x', [1, 2, 3, 4])).toEqual([1, 3, 6, 10])
    // 창을 가운데 두므로 값이 시간축에서 밀리지 않습니다.
    expect(evaluateSeries('avg(x, 3)', 'x', [0, 3, 0, 3, 0])).toEqual([1.5, 1, 2, 1, 1.5])
  })

  it('spreads a whole-column summary back over every row so a zero level can be subtracted', () => {
    expect(evaluateSeries('x - mean(x)', 'x', [1, 2, 3])).toEqual([-1, 0, 1])
    expect(evaluateSeries('x/first(x)', 'x', [4, 2, 1])).toEqual([1, 0.5, 0.25])
    expect(evaluateSeries('last(x)', 'x', [4, 2, 9])).toEqual([9, 9, 9])
    expect(evaluateSeries('max(x) - min(x)', 'x', [4, 2, 9])).toEqual([7, 7, 7])
    expect(evaluateSeries('count(x)', 'x', [4, null, 9])).toEqual([2, 2, 2])
  })

  it('counts how many values a function takes', () => {
    expect(compileExpression('avg(lux)', ['lux'])).toEqual({
      ok: false,
      error: 'avg에는 값을 2개 넣어야 합니다. 1개를 넣었습니다.',
    })
    expect(compileExpression('diff(lux, 2)', ['lux'])).toMatchObject({ ok: false })
  })

  /** `abs`와 `asin`은 열 이름 `a`로 시작해도 함수로 읽혀야 합니다. */
  it('tells a function from a column name that starts the same way', () => {
    expect(evaluateOnce('asin(a)', { a: 0.5 })).toBeCloseTo(30)
    expect(evaluateOnce('abs(a)', { a: -2 })).toBe(2)
    expect(evaluateOnce('a * 2', { a: 3, as: 5 })).toBe(6)
  })

  /**
   * 열 이름은 학생이 목록에서 그대로 옮겨 적습니다. 밑줄과 한글이 섞여 있고 한 이름이
   * 다른 이름의 앞부분일 수도 있으므로, 긴 이름부터 맞춰야 뒤가 남지 않습니다.
   */
  it('matches the longest column name so a prefix does not swallow it', () => {
    expect(evaluateOnce('time_ms_2 - time_ms', { time_ms: 100, time_ms_2: 250 })).toBe(150)
    expect(evaluateOnce('실_길이_m * 2', { 실_길이_m: 0.35 })).toBe(0.7)
  })

  it('gives back a value-free row instead of infinity or a not-a-number', () => {
    expect(evaluateOnce('ln(a)', { a: 0 })).toBeNull()
    expect(evaluateOnce('sqrt(a)', { a: -4 })).toBeNull()
    expect(evaluateOnce('a / b', { a: 1, b: 0 })).toBeNull()
    expect(evaluateOnce('a + b', { a: 1, b: null })).toBeNull()
  })

  it('explains what it could not read instead of throwing', () => {
    expect(compileExpression('lux * ', ['lux'])).toEqual({
      ok: false,
      error: '식이 끝나지 않았습니다. 괄호나 값이 빠지지 않았는지 확인하세요.',
    })
    expect(compileExpression('ln lux', ['lux'])).toMatchObject({ ok: false })
    expect(compileExpression('sqrt(lux', ['lux'])).toEqual({ ok: false, error: '닫는 괄호가 없습니다.' })
    expect(compileExpression('luxx * 2', ['lux'])).toMatchObject({ ok: false })
    expect(compileExpression('2 * 3', ['lux'])).toEqual({
      ok: false,
      error: '열 이름이 하나도 없습니다. 계산할 측정값 열을 식에 넣으세요.',
    })
  })

  /** 붙여넣은 자료가 밖으로 나가지 않는 화면에서 문자열을 실행하면 안 됩니다. */
  it('refuses anything that is not a number, a column name or an operator', () => {
    expect(compileExpression('fetch("/")', ['lux'])).toMatchObject({ ok: false })
    expect(compileExpression('lux; alert(1)', ['lux'])).toMatchObject({ ok: false })
  })
})

describe('buildColumns', () => {
  it('adds a condition value to every row of the run', () => {
    const built = buildColumns(HEADER, ROWS, [{ name: '실_길이_m', value: '0.35' }], [])

    expect(built.header).toEqual([...HEADER, '실_길이_m'])
    expect(built.rows.map((row) => row.at(-1))).toEqual(['0.35', '0.35', '0.35'])
  })

  it('calculates a column from the measurements and leaves the source rows alone', () => {
    const built = buildColumns(HEADER, ROWS, [], [{ name: 'ln_온도차', expression: 'ln(excess_temperature_c)' }])

    expect(built.rows.map((row) => Number(row.at(-1)).toFixed(4))).toEqual(['4.0073', '3.4012', '2.3026'])
    expect(ROWS[0]).toEqual(['0', '55', '0.2'])
  })

  it('lets a calculated column use the condition value and an earlier calculated column', () => {
    const built = buildColumns(
      HEADER,
      ROWS,
      [{ name: '각도_deg', value: '60' }],
      [
        { name: 'cos_theta', expression: '각도_deg * 0 + 0.5' },
        { name: 'cos2_theta', expression: 'cos_theta ^ 2' },
      ],
    )

    expect(built.header).toEqual([...HEADER, '각도_deg', 'cos_theta', 'cos2_theta'])
    expect(built.rows[0].slice(-3)).toEqual(['60', '0.5', '0.25'])
  })

  it('keeps the column in place and reports why when the expression cannot be read', () => {
    const built = buildColumns(HEADER, ROWS, [], [{ name: '엉뚱', expression: 'nope * 2' }])

    expect(built.header).toEqual([...HEADER, '엉뚱'])
    expect(built.rows.every((row) => row.at(-1) === '')).toBe(true)
    expect(built.errors['엉뚱']).toContain('읽을 수 없습니다')
  })

  it('leaves the cell empty for the rows whose value does not exist', () => {
    const built = buildColumns(
      ['t', 'v'],
      [['0', '5'], ['1', '0'], ['2', '-3']],
      [],
      [{ name: 'ln_v', expression: 'ln(v)' }],
    )

    // 유효숫자 열두 자리까지만 남깁니다. 측정값에 그보다 많은 자리는 뜻이 없습니다.
    expect(built.rows.map((row) => row.at(-1))).toEqual([String(Number(Math.log(5).toPrecision(12))), '', ''])
  })

  /** 0.1 + 0.2가 0.30000000000000004로 저장되면 표에 그대로 보입니다. */
  it('does not leave floating point dust in the saved value', () => {
    const built = buildColumns(['a', 'b'], [['0.1', '0.2']], [], [{ name: 'sum', expression: 'a + b' }])
    expect(built.rows[0].at(-1)).toBe('0.3')
  })
})

describe('validateColumnName', () => {
  it('accepts a plain name and refuses one that would break the table', () => {
    expect(validateColumnName('실_길이_m', HEADER)).toBeNull()
    expect(validateColumnName('  ', HEADER)).toBe('열 이름을 적어 주세요.')
    expect(validateColumnName('a,b', HEADER)).toContain('쉼표')
    expect(validateColumnName('time_ms', HEADER)).toContain('이미 time_ms 열이 있습니다')
    expect(validateColumnName('ln', HEADER)).toContain('함수 이름')
    expect(validateColumnName('2배', HEADER)).toContain('숫자로 시작')
  })
})
