/**
 * L2 compile gate (A3.2): compiles a sketch for the Uno with arduino-cli and
 * turns its reported memory usage into a severity the review UI can act on.
 *
 * Requires the project-local toolchain — run `npm run setup:arduino-cli` once.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { arduinoCliBin, arduinoEnv, sketchesDir, isArduinoCliInstalled, SETUP_HINT } from './arduinoCli'

const FQBN = 'arduino:avr:uno'

/** Plan thresholds: 80% of either memory is a warning, 95% is a hard error. */
export const WARNING_THRESHOLD = 80
export const ERROR_THRESHOLD = 95

export type Severity = 'ok' | 'warning' | 'error'

export interface CompileResult {
  compilePass: boolean
  sramPercent: number
  flashPercent: number
  severity: Severity
  /** Compiler diagnostics, surfaced so a failing gate can explain itself. */
  message: string
}

/**
 * arduino-cli reports every section with both its used and its maximum size,
 * so the Uno's limits (32256 B flash after the bootloader, 2048 B SRAM) never
 * have to be hardcoded here — they come from the board definition itself.
 * `text` is the flash section; `data` is the statically allocated SRAM.
 */
interface SectionSize {
  name: string
  size: number
  max_size: number
}

interface CompileJson {
  success: boolean
  compiler_out?: string
  compiler_err?: string
  builder_result?: { executable_sections_size?: SectionSize[] }
}

export function severityFor(sramPercent: number, flashPercent: number): Severity {
  const worst = Math.max(sramPercent, flashPercent)
  if (worst >= ERROR_THRESHOLD) return 'error'
  if (worst >= WARNING_THRESHOLD) return 'warning'
  return 'ok'
}

function percent(sections: SectionSize[], name: string): number {
  const section = sections.find((s) => s.name === name)
  if (!section || section.max_size <= 0) return 0
  return (section.size / section.max_size) * 100
}

/**
 * Writes `source` to `<.tools/sketches>/<name>/<name>.ino`. arduino-cli only
 * accepts a sketch *folder* whose name matches its main `.ino` file, so recipe
 * sketches (which live as strings in src/data) must be staged like this before
 * they can be compiled.
 */
export function stageSketch(name: string, source: string): string {
  const dir = join(sketchesDir, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const inoPath = join(dir, `${name}.ino`)
  writeFileSync(inoPath, source, 'utf-8')
  return inoPath
}

interface CliRun {
  stdout: string
  stderr: string
  /** Kept so an empty-output failure can say *why* the process ended. */
  code: number | null
  signal: NodeJS.Signals | null
}

function runArduinoCli(sketchDir: string): Promise<CliRun> {
  const args = ['compile', '--fqbn', FQBN, '--format', 'json', sketchDir]
  return new Promise((resolve, reject) => {
    const child = spawn(arduinoCliBin, args, { env: arduinoEnv() })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', reject)
    child.on('close', (code, signal) => resolve({ stdout, stderr, code, signal }))
  })
}

/**
 * @param sketchPath a `.ino` file or the sketch folder containing it.
 */
export async function compileSketch(sketchPath: string): Promise<CompileResult> {
  if (!isArduinoCliInstalled()) throw new Error(SETUP_HINT)

  const sketchDir = sketchPath.endsWith('.ino') ? dirname(sketchPath) : sketchPath

  let run = await runArduinoCli(sketchDir)
  // A sketch that genuinely fails to build still prints a JSON body with
  // `success: false`, so empty stdout never means "the code is wrong" — it
  // means the process never got far enough to report. Spawning many builds
  // back to back against a cold cache makes that happen transiently, and it
  // used to surface as an error indistinguishable from a real build failure.
  // Retrying only on empty output therefore cannot mask a broken sketch.
  if (run.stdout.trim() === '') run = await runArduinoCli(sketchDir)

  let parsed: CompileJson
  try {
    parsed = JSON.parse(run.stdout) as CompileJson
  } catch {
    // A non-JSON body means arduino-cli itself failed (bad FQBN, missing
    // core) rather than the sketch failing to compile. The exit status is
    // reported because with both streams empty there is nothing else to go on.
    const detail = run.stderr.trim() || run.stdout.trim() || '(both output streams were empty)'
    return {
      compilePass: false,
      sramPercent: 0,
      flashPercent: 0,
      severity: 'error',
      message: `${basename(sketchDir)}: arduino-cli produced no JSON `
        + `(exit=${run.code}, signal=${run.signal}, retried once).\n${detail}`,
    }
  }

  const sections = parsed.builder_result?.executable_sections_size ?? []
  const flashPercent = percent(sections, 'text')
  const sramPercent = percent(sections, 'data')
  const compilePass = parsed.success === true

  return {
    compilePass,
    sramPercent,
    flashPercent,
    // A sketch that does not build is always an error, regardless of the
    // (meaningless) memory figures reported alongside the failure.
    severity: compilePass ? severityFor(sramPercent, flashPercent) : 'error',
    message: compilePass
      ? (parsed.compiler_out ?? '')
      : (parsed.compiler_err ?? run.stderr ?? 'compilation failed'),
  }
}
