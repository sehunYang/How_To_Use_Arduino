import type { Phase5BehaviorSpec } from './behaviorSpecs'

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
 */
export function serialFromCliOutput(stdout: string): string {
  const lines = stdout.split(/\r?\n/)
  const start = lines.findIndex((line) => line.trim() === 'Starting simulation...')
  return lines
    .slice(start + 1)
    .filter((line) => !/^\[[^\]]+\] /.test(line))
    .join('\n')
}

/**
 * Judges a Wokwi serial log against a behaviour spec. The scenario's
 * wait-serial steps only prove each expected line appeared once; this checks
 * every row, so a stray NaN, an 85 °C power-on read, or a reading that does
 * not match any applied stimulus fails the run.
 */
export function checkSerialBehavior(spec: Phase5BehaviorSpec, log: string): SerialBehaviorResult {
  const failures: string[] = []
  const lines = log
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const headerIndex = lines.indexOf(spec.header)
  if (headerIndex === -1) {
    return { ok: false, rows: 0, failures: [`header "${spec.header}" never printed`] }
  }
  const unexpectedBeforeHeader = lines.slice(0, headerIndex).filter((line) => !line.startsWith('#'))
  if (unexpectedBeforeHeader.length > 0) {
    failures.push(`non-comment output before header: "${unexpectedBeforeHeader[0]}"`)
  }

  const columns = spec.header.split(',')
  const levels = [spec.stepColumn.initial, ...spec.stimuli.map((stimulus) => stimulus.value)]
  const seenLevels = new Set<number>()
  let level = 0
  let previousTime: number | undefined
  let rows = 0

  for (const [offset, line] of lines.slice(headerIndex + 1).entries()) {
    if (line.startsWith('#')) continue
    const where = `row ${offset + 1} "${line}"`
    const cells = line.split(',')
    if (cells.length !== columns.length) {
      failures.push(`${where}: expected ${columns.length} columns, got ${cells.length}`)
      continue
    }
    const values = cells.map((cell) => (/^-?\d+(\.\d+)?$/.test(cell) ? Number(cell) : Number.NaN))
    const badCell = values.findIndex((value) => !Number.isFinite(value))
    if (badCell !== -1) {
      failures.push(`${where}: ${columns[badCell]} is not a number`)
      continue
    }
    rows += 1
    const row = Object.fromEntries(columns.map((column, index) => [column, values[index]]))

    const time = row[spec.timeColumn]
    if (previousTime !== undefined) {
      const gap = time - previousTime
      if (gap < spec.sampleInterval.min || gap > spec.sampleInterval.max) {
        failures.push(
          `${where}: ${spec.timeColumn} step ${gap.toFixed(3)} outside ` +
            `[${spec.sampleInterval.min}, ${spec.sampleInterval.max}]`,
        )
      }
    }
    previousTime = time

    // The sensor only ever moves forward through the stimulus sequence.
    const measured = row[spec.stepColumn.column]
    const nextLevel = levels.findIndex(
      (candidate, index) => index >= level && Math.abs(measured - candidate) <= spec.stepColumn.tolerance,
    )
    if (nextLevel === -1) {
      failures.push(
        `${where}: ${spec.stepColumn.column}=${measured} matches no applied stimulus ` +
          `at or after ${levels[level]}`,
      )
    } else {
      level = nextLevel
      seenLevels.add(nextLevel)
    }

    for (const derived of spec.derived) {
      const expected = derived.expected(row)
      if (Math.abs(row[derived.column] - expected) > derived.tolerance) {
        failures.push(`${where}: ${derived.column}=${row[derived.column]}, expected ${expected.toFixed(3)}`)
      }
    }
  }

  if (rows < spec.minRows) failures.push(`only ${rows} data rows, expected at least ${spec.minRows}`)
  levels.forEach((value, index) => {
    if (!seenLevels.has(index)) failures.push(`${spec.stepColumn.column} never reported ${value}`)
  })

  return { ok: failures.length === 0, rows, failures }
}
