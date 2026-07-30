#!/usr/bin/env tsx
/**
 * One-time (idempotent) setup for the L2 compile gate. Run with:
 *   npm run setup:arduino-cli
 *
 * Downloads a pinned arduino-cli release into `.tools/arduino-cli`, then
 * installs the `arduino:avr` core and the libraries the canary sketches
 * include. Everything lands under `.tools/` (gitignored) rather than in a
 * system-wide location — see src/verification/arduinoCli.ts.
 *
 * The npm package `arduino-cli` was evaluated and rejected: it was last
 * published in 2021 (wrapping a 0.x CLI, far behind the 1.x JSON output this
 * gate parses) and is AGPL-3.0, which is not something to pull into the
 * dependency tree for a build tool. Downloading the official upstream release
 * keeps us on a current, permissively licensed binary.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  arduinoCliBin,
  arduinoEnv,
  toolsDir,
  isArduinoCliInstalled,
} from '../src/verification/arduinoCli'

const ARDUINO_CLI_VERSION = '1.5.1'

/** Libraries pulled from the Arduino library index for all Phase 5 sketches. */
const REQUIRED_LIBRARIES = [
  'MPU6050',
  'Adafruit TSL2591 Library',
  'Adafruit Unified Sensor',
  'Adafruit BusIO',
  'Adafruit BME280 Library',
  'Adafruit INA219',
  'OneWire',
  'DallasTemperature',
  'TCA9548A',
]

function releaseAsset(): string {
  const platform = process.platform
  const arch = process.arch
  if (platform === 'win32') return `arduino-cli_${ARDUINO_CLI_VERSION}_Windows_64bit.zip`
  if (platform === 'darwin') {
    return arch === 'arm64'
      ? `arduino-cli_${ARDUINO_CLI_VERSION}_macOS_ARM64.tar.gz`
      : `arduino-cli_${ARDUINO_CLI_VERSION}_macOS_64bit.tar.gz`
  }
  if (platform === 'linux') {
    return arch === 'arm64'
      ? `arduino-cli_${ARDUINO_CLI_VERSION}_Linux_ARM64.tar.gz`
      : `arduino-cli_${ARDUINO_CLI_VERSION}_Linux_64bit.tar.gz`
  }
  throw new Error(`Unsupported platform: ${platform}/${arch}`)
}

function run(bin: string, args: string[]): void {
  console.log(`$ ${bin} ${args.join(' ')}`)
  const result = spawnSync(bin, args, {
    env: arduinoEnv(),
    stdio: 'inherit',
    // arduino-cli's core/lib downloads are large and slow on a cold cache.
    timeout: 15 * 60 * 1000,
  })
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${bin} ${args.join(' ')}`)
  }
}

async function downloadBinary(): Promise<void> {
  const asset = releaseAsset()
  const url = `https://github.com/arduino/arduino-cli/releases/download/v${ARDUINO_CLI_VERSION}/${asset}`
  const archive = join(toolsDir, asset)

  mkdirSync(toolsDir, { recursive: true })
  console.log(`Downloading ${url}`)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`)
  }
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()))

  // bsdtar unpacks both the .zip and .tar.gz release flavours, so one call
  // covers every platform. On Windows it must be addressed by absolute path:
  // a `tar` on PATH is usually Git Bash's GNU tar, which cannot read zips.
  // The archive is passed relatively with cwd set to toolsDir because bsdtar
  // reads a leading `C:\` as a remote host spec and fails to resolve it.
  const tar =
    process.platform === 'win32'
      ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
      : 'tar'
  console.log(`Extracting ${asset}`)
  const extract = spawnSync(tar, ['-xf', asset], { cwd: toolsDir, stdio: 'inherit' })
  if (extract.status !== 0) throw new Error('Extraction failed')
  rmSync(archive, { force: true })
}

async function main(): Promise<void> {
  if (isArduinoCliInstalled()) {
    console.log(`arduino-cli already present at ${arduinoCliBin} — skipping download.`)
  } else {
    await downloadBinary()
    if (!existsSync(arduinoCliBin)) {
      throw new Error(`Expected binary at ${arduinoCliBin} after extraction`)
    }
  }

  run(arduinoCliBin, ['version'])
  run(arduinoCliBin, ['core', 'update-index'])
  run(arduinoCliBin, ['core', 'install', 'arduino:avr'])
  run(arduinoCliBin, ['lib', 'update-index'])
  for (const lib of REQUIRED_LIBRARIES) {
    run(arduinoCliBin, ['lib', 'install', lib])
  }

  console.log('\narduino-cli setup complete.')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
