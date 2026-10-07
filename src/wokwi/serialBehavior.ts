import type { CellExpectation, ParsedRow, Phase5BehaviorSpec } from './behaviorSpecs'

export interface SerialBehaviorResult {
  ok: boolean
  rows: number
  failures: string[]
}

/**
 * Recovers the board's serial output from wokwi-cli stdout. The CLI's own
 * `--serial-log-file` is unusable: it exits without flushing that stream, so
 * the file can end up empty. Stdout carries the same bytes, preceded by the
 * CLI banner and interleaved with `[scenario name] ...` progress lines.
 *
 * A progress line that lands mid-row is printed on its own line, splitting
 * that row in two (wokwi-cli TestScenario.log). Given the CSV's column count,
 * a fragment and its continuation are rejoined when only together they form
 * one row.
 */
export function serialFromCliOutput(stdout: string, columnCount?: number): string {
  const lines = stdout.split(/\r?\n/)
  const start = lines.findIndex((line) => line.trim() === 'Starting simulation...')
  const columns = (line: string) => line.split(',').length
  const serial: string[] = []
  let interrupted = false
  for (const line of lines.slice(start + 1)) {
    if (/^\[[^\]]+\] /.test(line)) {
      interrupted = true
      continue
    }
    if (line.trim() === '') continue
    const previous = serial[serial.length - 1]
    if (interrupted && columnCount !== undefined && previous !== undefined) {
      const joined = previous + line
      const wasCut = columns(previous) !== columnCount || columns(line) !== columnCount || previous.endsWith(',')
      if (wasCut && columns(joined) === columnCount) {
        serial[serial.length - 1] = joined
        interrupted = false
        continue
      }
    }
    interrupted = false
    serial.push(line)
  }
  return serial.join('\n')
}

const NUMBER = /^-?\d+(\.\d+)?$/

/** Returns why `row` misses `expectation` for `column`, or undefined when it holds. */
function missed(
  column: string,
  expectation: CellExpectation,
  row: ParsedRow,
  previous: readonly ParsedRow[],
): string | undefined {
  const value = row.values[column]
  if ('text' in expectation) {
    return row.cells[column] === expectation.text
      ? undefined
      : `${column}="${row.cells[column]}", expected "${expectation.text}"`
  }
  if ('min' in expectation) {
    return value >= expectation.min && value <= expectation.max
      ? undefined
      : `${column}=${value} outside [${expectation.min}, ${expectation.max}]`
  }
  if ('oneOf' in expectation) {
    return expectation.oneOf.some((candidate) => Math.abs(value - candidate) <= expectation.tolerance)
      ? undefined
      : `${column}=${value} not one of ${expectation.oneOf.join('/')}`
  }
  const expected = 'approx' in expectation ? expectation.approx : expectation.derived(row, previous)
  return Math.abs(value - expected) <= expectation.tolerance
    ? undefined
    : `${column}=${value}, expected ${Number(expected.toFixed(4))}±${expectation.tolerance}`
}

function misses(
  expectations: Readonly<Record<string, CellExpectation>> | undefined,
  row: ParsedRow,
  previous: readonly ParsedRow[],
): string[] {
  return Object.entries(expectations ?? {})
    .map(([column, expectation]) => missed(column, expectation, row, previous))
    .filter((reason): reason is string => reason !== undefined)
}

/**
 * Judges a Wokwi serial log against a behaviour spec. The scenario's
 * wait-serial steps only prove each expected line appeared once; this checks
 * every row. Rows must walk forward through the spec's phases (the physical
 * situations the scenario creates, in order), each row matching its phase's
 * expectations, so a stray NaN, an 85 °C power-on read, or a value that fits
 * no applied stimulus fails the run. A phase may allow a few `settleRows`
 * before it, for readings taken while the stimulus was changing.
 */
export function checkSerialBehavior(spec: Phase5BehaviorSpec, log: string): SerialBehaviorResult {
  const result = checkLines(spec, log)
  if (result.ok) return result
  // The simulation stops the moment the scenario's last step completes, which
  // can cut the line the board was still printing. Only that final line may be
  // dropped, and only if everything before it passes.
  const lines = log.trimEnd().split(/\r?\n/)
  const withoutLast = checkLines(spec, lines.slice(0, -1).join('\n'))
  return withoutLast.ok ? withoutLast : result
}

function checkLines(spec: Phase5BehaviorSpec, log: string): SerialBehaviorResult {
  const failures: string[] = []
  const allowedComments = new Set(spec.allowedComments ?? [])
  const lines = log
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const headerIndex = lines.indexOf(spec.header)
  if (headerIndex === -1) {
    return { ok: false, rows: 0, failures: [`header "${spec.header}" never printed`] }
  }
  for (const line of lines.slice(0, headerIndex)) {
    if (!line.startsWith('#')) failures.push(`non-comment output before header: "${line}"`)
    else if (!allowedComments.has(line)) failures.push(`unexpected diagnostic before header: "${line}"`)
  }

  const columns = spec.header.split(',')
  const textColumns = new Set(spec.textColumns ?? [])
  const rows: ParsedRow[] = []
  const seenPhases = new Set<number>()
  let phase = 0
  let settleBudget = spec.phases[1]?.settleRows ?? 0
  let previousPhase: number | undefined
  let startupBudget = spec.startupRows ?? 0

  for (const [offset, line] of lines.slice(headerIndex + 1).entries()) {
    const where = `line ${offset + 1} "${line}"`
    if (line.startsWith('#')) {
      if (!allowedComments.has(line)) failures.push(`${where}: unexpected diagnostic`)
      continue
    }
    const cells = line.split(',')
    if (cells.length !== columns.length) {
      failures.push(`${where}: expected ${columns.length} columns, got ${cells.length}`)
      continue
    }
    const badCell = cells.findIndex((cell, index) => !textColumns.has(columns[index]) && !NUMBER.test(cell))
    if (badCell !== -1) {
      failures.push(`${where}: ${columns[badCell]} is not a number`)
      continue
    }
    const row: ParsedRow = {
      cells: Object.fromEntries(columns.map((column, index) => [column, cells[index]])),
      values: Object.fromEntries(columns.map((column, index) => [column, Number(cells[index])])),
    }
    const previous = rows.slice()
    rows.push(row)

    for (const reason of misses(spec.always, row, previous)) failures.push(`${where}: ${reason}`)

    if (spec.timeColumn && previous.length > 0) {
      const interval = (previousPhase === undefined ? undefined : spec.phases[previousPhase].sampleInterval)
        ?? spec.sampleInterval
      const gap = row.values[spec.timeColumn] - previous[previous.length - 1].values[spec.timeColumn]
      if (interval && (gap < interval.min || gap > interval.max)) {
        failures.push(
          `${where}: ${spec.timeColumn} step ${Number(gap.toFixed(3))} outside [${interval.min}, ${interval.max}]`,
        )
      }
    }

    // Stay in the current phase while it fits; otherwise move to the first later phase that does.
    if (misses(spec.phases[phase].expect, row, previous).length === 0) {
      seenPhases.add(phase)
      previousPhase = phase
      continue
    }
    const next = spec.phases.findIndex(
      (candidate, index) => index > phase && misses(candidate.expect, row, previous).length === 0,
    )
    if (next !== -1) {
      phase = next
      seenPhases.add(phase)
      previousPhase = phase
      settleBudget = spec.phases[phase + 1]?.settleRows ?? 0
      continue
    }
    if (seenPhases.size === 0 && startupBudget > 0) {
      startupBudget -= 1
      continue
    }
    // Settle rows sit between two phases, so the current one must have been reached first.
    if (settleBudget > 0 && seenPhases.has(phase)) {
      settleBudget -= 1
      continue
    }
    const reasons = misses(spec.phases[phase].expect, row, previous)
    failures.push(`${where}: fits no phase from "${spec.phases[phase].label}" on (${reasons.join('; ')})`)
  }

  if (rows.length < spec.minRows) failures.push(`only ${rows.length} data rows, expected at least ${spec.minRows}`)
  spec.phases.forEach((candidate, index) => {
    if (!seenPhases.has(index)) failures.push(`phase "${candidate.label}" never observed`)
  })
  for (const reason of spec.checkRows?.(rows) ?? []) failures.push(reason)

  return { ok: failures.length === 0, rows: rows.length, failures }
}
