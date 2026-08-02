/**
 * 붙여넣은 측정값 위에 열을 더합니다.
 *
 * 레시피의 "데이터 처리"는 대부분 시리얼로 나오지 않는 값을 요구합니다. 실의 길이나
 * 편광판 각도처럼 **사람이 자로 재어 적는 값**이 있고, 온도 차의 자연로그나 cos²θ처럼
 * 측정값에서 **계산해 만드는 값**이 있습니다. 둘 다 없으면 학생은 그래프를 그리려고
 * 표 계산 프로그램으로 옮겨 가야 하고, 그 순간 이 화면의 요약·회귀·저장이 모두 끊깁니다.
 *
 * 식은 한 행씩이 아니라 **열 전체**를 놓고 계산합니다. 속도(이웃한 두 행의 차이),
 * 공급 에너지(행을 쌓은 누적합), 이동평균처럼 레시피가 요구하는 계산은 그 행 하나만
 * 봐서는 만들 수 없기 때문입니다. 영점 빼기(`hall_raw - mean(hall_raw)`)나 처음 값으로
 * 나누기(`gyro_z_dps/first(gyro_z_dps)`)도 같은 이유로 여기서 함께 풀립니다.
 *
 * 식은 `eval`로 풀지 않고 직접 읽습니다. 붙여넣은 자료가 브라우저 밖으로 나가지 않는
 * 화면에서 문자열을 그대로 실행하면, 학생이 어디선가 복사해 온 한 줄이 그대로 코드가
 * 됩니다. 읽을 수 있는 것은 숫자·열 이름·괄호·사칙연산·거듭제곱과 아래 함수뿐입니다.
 */
import { parseMeasurement } from '@/lib/dataStats'

/** 회차마다 사람이 값을 적어 넣는 열. 한 회차 안에서는 모든 행이 같은 값입니다. */
export interface ManualColumn {
  name: string
  /** 이 회차에서 적어 넣은 값. 비워 두면 그 회차는 빈 칸이 됩니다. */
  value: string
}

/** 다른 열로부터 한 줄짜리 식으로 만드는 열. */
export interface CalculatedColumn {
  name: string
  expression: string
}

/** 열 하나를 행 순서대로 담은 값. 숫자로 읽을 수 없는 칸은 null입니다. */
export type ValueSeries = (number | null)[]

/**
 * 각도를 라디안이 아니라 도(°)로 다룹니다. 이 저장소의 레시피에서 각도가 나오는 곳은
 * 각도기로 잰 값(경사각, 편광판 각도)이거나 `tilt_deg`처럼 도 단위로 출력되는 열이고,
 * 라디안으로 두면 학생이 식마다 π/180을 곱해야 해 그 자체가 새로운 실수의 원인이
 * 됩니다. 역함수도 같은 이유로 도를 돌려줍니다.
 */
const DEGREE = Math.PI / 180

/** 값 하나를 값 하나로 바꾸는 함수. 행마다 따로 계산합니다. */
const POINT_FUNCTIONS: Record<string, (value: number) => number> = {
  ln: Math.log,
  log: Math.log10,
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
  sin: (value) => Math.sin(value * DEGREE),
  cos: (value) => Math.cos(value * DEGREE),
  tan: (value) => Math.tan(value * DEGREE),
  asin: (value) => Math.asin(value) / DEGREE,
  acos: (value) => Math.acos(value) / DEGREE,
  atan: (value) => Math.atan(value) / DEGREE,
}

function numbersOf(series: ValueSeries): number[] {
  return series.filter((value): value is number => value !== null)
}

/** 열 전체를 하나의 값으로 줄인 뒤, 모든 행에 같은 값을 놓는 함수. */
const SUMMARY_FUNCTIONS: Record<string, (values: number[], series: ValueSeries) => number | null> = {
  mean: (values) => (values.length === 0 ? null : values.reduce((total, value) => total + value, 0) / values.length),
  min: (values) => (values.length === 0 ? null : Math.min(...values)),
  max: (values) => (values.length === 0 ? null : Math.max(...values)),
  first: (_values, series) => series.find((value) => value !== null) ?? null,
  last: (_values, series) => [...series].reverse().find((value) => value !== null) ?? null,
  count: (values) => values.length,
}

/** 이웃한 행을 함께 보는 함수. */
const SERIES_FUNCTIONS: Record<string, { arity: number; apply: (series: ValueSeries, argument?: number) => ValueSeries }> = {
  /** 바로 앞 행의 값. 첫 행은 앞이 없어 빈 칸입니다. */
  prev: {
    arity: 1,
    apply: (series) => series.map((_value, index) => (index === 0 ? null : series[index - 1])),
  },
  /** 앞 행과의 차이. 시간으로 나누면 변화율(속도)이 됩니다. */
  diff: {
    arity: 1,
    apply: (series) =>
      series.map((value, index) => {
        if (index === 0) return null
        const previous = series[index - 1]
        return value === null || previous === null ? null : value - previous
      }),
  },
  /**
   * 첫 행부터 그 행까지의 합. 표본 간격을 곱하면 넓이(적분)가 되어 공급 에너지나
   * 속도 변화량을 구할 수 있습니다.
   */
  cumsum: {
    arity: 1,
    apply: (series) => {
      let total = 0
      return series.map((value) => {
        if (value === null) return null
        total += value
        return total
      })
    },
  },
  /**
   * 앞뒤를 함께 본 이동평균. 창을 가운데에 두어 값이 시간축에서 밀리지 않게 하고,
   * 양 끝은 있는 값만으로 평균을 냅니다.
   */
  avg: {
    arity: 2,
    apply: (series, argument) => {
      const window = Math.max(1, Math.round(argument ?? 1))
      const half = Math.floor(window / 2)
      return series.map((_value, index) => {
        const slice = numbersOf(series.slice(Math.max(0, index - half), index + half + 1))
        return slice.length === 0 ? null : slice.reduce((total, value) => total + value, 0) / slice.length
      })
    },
  },
}

export const FUNCTION_HELP: Array<{ name: string; usage: string; meaning: string }> = [
  { name: 'ln', usage: 'ln(값)', meaning: '자연로그' },
  { name: 'log', usage: 'log(값)', meaning: '상용로그' },
  { name: 'sqrt', usage: 'sqrt(값)', meaning: '제곱근' },
  { name: 'abs', usage: 'abs(값)', meaning: '절댓값' },
  { name: 'exp', usage: 'exp(값)', meaning: 'e의 거듭제곱' },
  { name: 'sin', usage: 'sin(각도)', meaning: '사인 (도 단위)' },
  { name: 'cos', usage: 'cos(각도)', meaning: '코사인 (도 단위)' },
  { name: 'tan', usage: 'tan(각도)', meaning: '탄젠트 (도 단위)' },
  { name: 'asin', usage: 'asin(값)', meaning: '사인의 역함수, 도로 돌려줌' },
  { name: 'acos', usage: 'acos(값)', meaning: '코사인의 역함수, 도로 돌려줌' },
  { name: 'atan', usage: 'atan(값)', meaning: '탄젠트의 역함수, 도로 돌려줌' },
  { name: 'mean', usage: 'mean(열)', meaning: '그 열 전체의 평균 (영점 빼기에 씁니다)' },
  { name: 'min', usage: 'min(열)', meaning: '그 열의 최솟값' },
  { name: 'max', usage: 'max(열)', meaning: '그 열의 최댓값' },
  { name: 'first', usage: 'first(열)', meaning: '그 열의 첫 값 (처음 값으로 나눌 때)' },
  { name: 'last', usage: 'last(열)', meaning: '그 열의 마지막 값' },
  { name: 'count', usage: 'count(열)', meaning: '숫자로 읽은 값의 개수' },
  { name: 'prev', usage: 'prev(열)', meaning: '바로 앞 행의 값' },
  { name: 'diff', usage: 'diff(열)', meaning: '앞 행과의 차이 (속도·변화율)' },
  { name: 'cumsum', usage: 'cumsum(열)', meaning: '첫 행부터 쌓은 합 (넓이·누적 에너지)' },
  { name: 'avg', usage: 'avg(열, 창)', meaning: '앞뒤를 함께 본 이동평균' },
]

export const FUNCTION_NAMES = [
  ...Object.keys(POINT_FUNCTIONS),
  ...Object.keys(SUMMARY_FUNCTIONS),
  ...Object.keys(SERIES_FUNCTIONS),
  // 긴 이름부터 맞춰야 `asin`이 `a`+`sin`으로 갈라지지 않습니다.
].sort((first, second) => second.length - first.length)

type Node =
  | { kind: 'number'; value: number }
  | { kind: 'column'; name: string }
  | { kind: 'negate'; operand: Node }
  | { kind: 'binary'; operator: '+' | '-' | '*' | '/' | '^'; left: Node; right: Node }
  | { kind: 'call'; name: string; args: Node[] }

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'column'; name: string }
  | { kind: 'function'; name: string }
  | { kind: 'symbol'; value: string }

const NUMBER_PATTERN = /^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/

function tokenize(source: string, columnNames: readonly string[]): Token[] {
  // 이름이 긴 것부터 맞춰 봅니다. `time_ms`와 `time_ms_2`가 함께 있을 때
  // 짧은 쪽을 먼저 떼면 남은 `_2`를 읽지 못합니다.
  const names = [...columnNames].sort((first, second) => second.length - first.length)
  const tokens: Token[] = []
  let index = 0

  while (index < source.length) {
    const character = source[index]
    if (/\s/.test(character)) {
      index += 1
      continue
    }
    if ('+-*/^(),'.includes(character)) {
      tokens.push({ kind: 'symbol', value: character })
      index += 1
      continue
    }

    const name = names.find((candidate) => candidate.length > 0 && source.startsWith(candidate, index))
    // 함수는 뒤에 괄호가 따라올 때만 함수로 봅니다. `a`라는 열이 있어도 `abs(...)`가
    // `a` 다음에 `bs(`가 남는 식으로 읽히지 않게 하려는 것입니다.
    const functionName = FUNCTION_NAMES.find(
      (candidate) => source.startsWith(candidate, index) && /^\s*\(/.test(source.slice(index + candidate.length)),
    )

    if (functionName && (!name || functionName.length >= name.length)) {
      tokens.push({ kind: 'function', name: functionName })
      index += functionName.length
      continue
    }

    if (name) {
      tokens.push({ kind: 'column', name })
      index += name.length
      continue
    }

    const number = NUMBER_PATTERN.exec(source.slice(index))
    if (number) {
      tokens.push({ kind: 'number', value: Number(number[0]) })
      index += number[0].length
      continue
    }

    throw new Error(`'${source.slice(index, index + 10)}'을(를) 읽을 수 없습니다. 열 이름은 위 목록에서 그대로 옮겨 적으세요.`)
  }

  return tokens
}

function expectedArity(name: string) {
  if (SERIES_FUNCTIONS[name]) return SERIES_FUNCTIONS[name].arity
  return 1
}

function parse(tokens: readonly Token[]): Node {
  let position = 0

  const peek = () => tokens[position]
  const takeSymbol = (value: string) => {
    const token = peek()
    if (token?.kind === 'symbol' && token.value === value) {
      position += 1
      return true
    }
    return false
  }

  function parseSum(): Node {
    let left = parseProduct()
    for (;;) {
      if (takeSymbol('+')) left = { kind: 'binary', operator: '+', left, right: parseProduct() }
      else if (takeSymbol('-')) left = { kind: 'binary', operator: '-', left, right: parseProduct() }
      else return left
    }
  }

  function parseProduct(): Node {
    let left = parseUnary()
    for (;;) {
      if (takeSymbol('*')) left = { kind: 'binary', operator: '*', left, right: parseUnary() }
      else if (takeSymbol('/')) left = { kind: 'binary', operator: '/', left, right: parseUnary() }
      else return left
    }
  }

  /**
   * 앞에 붙는 음수 부호는 거듭제곱보다 나중에 묶습니다. 수학에서 −a²은 −(a²)이므로,
   * 손으로 적던 식을 그대로 옮겨 적어도 뜻이 달라지지 않습니다.
   */
  function parseUnary(): Node {
    if (takeSymbol('-')) return { kind: 'negate', operand: parseUnary() }
    if (takeSymbol('+')) return parseUnary()
    return parsePower()
  }

  function parsePower(): Node {
    const base = parsePrimary()
    // 거듭제곱은 오른쪽부터 묶습니다(2^3^2 = 2^9).
    if (takeSymbol('^')) return { kind: 'binary', operator: '^', left: base, right: parseUnary() }
    return base
  }

  function parsePrimary(): Node {
    const token = peek()
    if (!token) throw new Error('식이 끝나지 않았습니다. 괄호나 값이 빠지지 않았는지 확인하세요.')

    if (token.kind === 'number') {
      position += 1
      return { kind: 'number', value: token.value }
    }
    if (token.kind === 'column') {
      position += 1
      return { kind: 'column', name: token.name }
    }
    if (token.kind === 'function') {
      position += 1
      if (!takeSymbol('(')) throw new Error(`${token.name} 다음에는 괄호를 열어야 합니다. 예: ${token.name}(값)`)
      const args = [parseSum()]
      while (takeSymbol(',')) args.push(parseSum())
      if (!takeSymbol(')')) throw new Error('닫는 괄호가 없습니다.')
      const arity = expectedArity(token.name)
      if (args.length !== arity) {
        throw new Error(`${token.name}에는 값을 ${arity}개 넣어야 합니다. ${args.length}개를 넣었습니다.`)
      }
      return { kind: 'call', name: token.name, args }
    }
    if (token.value === '(') {
      position += 1
      const inner = parseSum()
      if (!takeSymbol(')')) throw new Error('닫는 괄호가 없습니다.')
      return inner
    }

    throw new Error(`'${token.value}'를 여기에 쓸 수 없습니다.`)
  }

  const node = parseSum()
  if (position < tokens.length) {
    const rest = tokens[position]
    const shown = rest.kind === 'symbol' ? rest.value : rest.kind === 'column' ? rest.name : String('value' in rest ? rest.value : rest.name)
    throw new Error(`'${shown}' 뒤부터는 식으로 읽을 수 없습니다.`)
  }
  return node
}

function fill(value: number | null, length: number): ValueSeries {
  return Array.from({ length }, () => value)
}

/** 계산 결과가 값이 될 수 없으면(0의 로그, 0으로 나누기) 그 행을 빈 칸으로 둡니다. */
function finiteOrNull(value: number) {
  return Number.isFinite(value) ? value : null
}

function evaluate(node: Node, columns: ReadonlyMap<string, ValueSeries>, length: number): ValueSeries {
  if (node.kind === 'number') return fill(node.value, length)
  if (node.kind === 'column') return columns.get(node.name) ?? fill(null, length)

  if (node.kind === 'negate') {
    return evaluate(node.operand, columns, length).map((value) => (value === null ? null : -value))
  }

  if (node.kind === 'call') {
    const first = evaluate(node.args[0], columns, length)

    const point = POINT_FUNCTIONS[node.name]
    if (point) return first.map((value) => (value === null ? null : finiteOrNull(point(value))))

    const summary = SUMMARY_FUNCTIONS[node.name]
    if (summary) {
      const value = summary(numbersOf(first), first)
      return fill(value === null ? null : finiteOrNull(value), length)
    }

    const series = SERIES_FUNCTIONS[node.name]
    const argument = node.args[1] ? evaluate(node.args[1], columns, length)[0] ?? undefined : undefined
    return series.apply(first, argument).map((value) => (value === null ? null : finiteOrNull(value)))
  }

  const left = evaluate(node.left, columns, length)
  const right = evaluate(node.right, columns, length)
  return left.map((leftValue, index) => {
    const rightValue = right[index]
    if (leftValue === null || rightValue === null) return null
    const result = node.operator === '+' ? leftValue + rightValue
      : node.operator === '-' ? leftValue - rightValue
        : node.operator === '*' ? leftValue * rightValue
          : node.operator === '/' ? leftValue / rightValue
            : leftValue ** rightValue
    return finiteOrNull(result)
  })
}

export interface CompiledExpression {
  /** 열 전체를 받아 계산 결과를 행 순서대로 돌려줍니다. */
  evaluate: (columns: ReadonlyMap<string, ValueSeries>, length: number) => ValueSeries
  /** 식이 실제로 쓴 열 이름 */
  references: string[]
}

export type CompileResult = { ok: true; compiled: CompiledExpression } | { ok: false; error: string }

/** 식 한 줄을 읽어 계산기를 만듭니다. 읽지 못하면 까닭을 한국어로 돌려줍니다. */
export function compileExpression(source: string, columnNames: readonly string[]): CompileResult {
  if (!source.trim()) return { ok: false, error: '식을 적어 주세요.' }
  try {
    const tokens = tokenize(source, columnNames)
    const node = parse(tokens)
    const references = [...new Set(
      tokens.filter((token): token is Token & { kind: 'column' } => token.kind === 'column').map((token) => token.name),
    )]
    if (references.length === 0) {
      return { ok: false, error: '열 이름이 하나도 없습니다. 계산할 측정값 열을 식에 넣으세요.' }
    }
    return {
      ok: true,
      compiled: { evaluate: (columns, length) => evaluate(node, columns, length), references },
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '식을 읽을 수 없습니다.' }
  }
}

/**
 * 계산 결과를 CSV 칸에 넣을 문자열로 바꿉니다. 값이 없으면 빈 칸으로 둡니다.
 * 유효숫자를 열두 자리로 자르는 것은 0.1+0.2가 0.30000000000000004로 저장되어
 * 표에 그대로 보이는 일을 막기 위해서입니다.
 */
function formatValue(value: number | null): string {
  if (value === null) return ''
  return String(Number(value.toPrecision(12)))
}

export interface ColumnBuild {
  header: string[]
  rows: string[][]
  /** 계산하지 못한 열 이름 → 까닭 */
  errors: Record<string, string>
}

/**
 * 붙여넣은 표에 조건 값 열과 계산 열을 덧붙입니다.
 *
 * 계산 열은 적은 순서대로 계산하고, 앞서 만든 열을 뒤의 식에서 다시 쓸 수 있습니다.
 * 온도 차를 먼저 만들고 그 로그를 다음 열에서 취하는 식이 레시피에 자주 나옵니다.
 *
 * 회차마다 따로 부르는 것이 중요합니다. `diff`나 `cumsum`이 회차 경계를 넘어가면
 * 앞 회차의 마지막 값과 다음 회차의 첫 값을 이어 계산해 버립니다.
 */
export function buildColumns(
  header: readonly string[],
  rows: readonly string[][],
  manual: readonly ManualColumn[],
  calculated: readonly CalculatedColumn[],
): ColumnBuild {
  const nextHeader = [...header]
  const nextRows = rows.map((row) => [...row])
  const errors: Record<string, string> = {}

  for (const column of manual) {
    nextHeader.push(column.name)
    for (const row of nextRows) row.push(column.value.trim())
  }

  for (const column of calculated) {
    const result = compileExpression(column.expression, nextHeader)
    if (!result.ok) {
      errors[column.name] = result.error
      // 열은 자리를 지켜 두어야 회차끼리 열 이름이 어긋나지 않습니다.
      nextHeader.push(column.name)
      for (const row of nextRows) row.push('')
      continue
    }

    const columns = new Map<string, ValueSeries>(
      nextHeader.map((name, index) => [name, nextRows.map((row) => parseMeasurement(row[index] ?? ''))]),
    )
    const values = result.compiled.evaluate(columns, nextRows.length)
    nextHeader.push(column.name)
    nextRows.forEach((row, index) => row.push(formatValue(values[index] ?? null)))
  }

  return { header: nextHeader, rows: nextRows, errors }
}

/** 새 열 이름이 쓸 수 있는 이름인지 확인합니다. */
export function validateColumnName(name: string, existing: readonly string[]): string | null {
  const trimmed = name.trim()
  if (!trimmed) return '열 이름을 적어 주세요.'
  if (trimmed.includes(',')) return '열 이름에는 쉼표를 쓸 수 없습니다. CSV의 칸 구분과 겹칩니다.'
  if (existing.includes(trimmed)) return `이미 ${trimmed} 열이 있습니다. 다른 이름을 쓰세요.`
  if (FUNCTION_NAMES.includes(trimmed)) return `${trimmed}은(는) 계산에 쓰는 함수 이름이라 열 이름으로 쓸 수 없습니다.`
  if (NUMBER_PATTERN.test(trimmed)) return '숫자로 시작하는 이름은 식에서 숫자와 구별되지 않습니다.'
  return null
}
