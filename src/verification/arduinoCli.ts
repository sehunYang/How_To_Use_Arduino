/**
 * Locates the project-local arduino-cli toolchain.
 *
 * arduino-cli is deliberately NOT installed system-wide: the binary, the
 * `arduino:avr` core and every library live under `.tools/arduino-cli`
 * (gitignored) so the compile gate leaves no footprint outside the repo.
 * `scripts/setup-arduino-cli.ts` populates that directory.
 */
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

export const toolsDir = join(repoRoot, '.tools', 'arduino-cli')

export const arduinoCliBin = join(
  toolsDir,
  process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli',
)

/** Where extracted `.ino` sketch folders are staged for compilation. */
export const sketchesDir = join(repoRoot, '.tools', 'sketches')

/**
 * arduino-cli reads its data/downloads/user directories from the environment,
 * so pointing them into `.tools` is what actually keeps cores and libraries
 * out of the user's home directory.
 */
export function arduinoEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ARDUINO_DIRECTORIES_DATA: join(toolsDir, 'data'),
    ARDUINO_DIRECTORIES_DOWNLOADS: join(toolsDir, 'downloads'),
    ARDUINO_DIRECTORIES_USER: join(toolsDir, 'user'),
  }
}

export function isArduinoCliInstalled(): boolean {
  return existsSync(arduinoCliBin)
}

export const SETUP_HINT =
  'arduino-cli is not installed. Run `npm run setup:arduino-cli` first.'
