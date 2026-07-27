#!/usr/bin/env node
// Fetches the L5 host C++ compiler into node_modules/.zig — no system-wide install.
//
// Zig bundles clang as `zig c++`, so this single download gives the logic/ harness a
// hermetic host compiler with no admin rights and nothing outside node_modules.
//
// Why not the `@ziglang/cli` npm package: its postinstall hardcodes
// `curl -fsSL <tarball> | tar xJ`, but Windows Zig ships as .zip, so extraction always
// fails ("xz: File format not recognized"). It is POSIX-only throughout (`which`,
// `ln -sf`, PATH split on ':'). This script is the cross-platform equivalent.

import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ZIG_VERSION = '0.14.1'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const installRoot = path.join(repoRoot, 'node_modules', '.zig')

const ARCH = { x64: 'x86_64', arm64: 'aarch64' }[process.arch]
const PLATFORM = { darwin: 'macos', linux: 'linux', win32: 'windows', freebsd: 'freebsd' }[
  process.platform
]

/** Absolute path to the zig binary this script installs (may not exist yet). */
function zigBinaryPath() {
  const exe = process.platform === 'win32' ? 'zig.exe' : 'zig'
  return path.join(installRoot, `zig-${ARCH}-${PLATFORM}-${ZIG_VERSION}`, exe)
}

async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function extract(archive, destDir) {
  if (archive.endsWith('.zip')) {
    // Git Bash's GNU tar cannot read zip, so go through PowerShell's Expand-Archive.
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -LiteralPath '${archive}' -DestinationPath '${destDir}' -Force`,
      ],
      { stdio: 'inherit' },
    )
  } else {
    execFileSync('tar', ['-xJf', archive, '-C', destDir], { stdio: 'inherit' })
  }
}

export async function setupZig() {
  if (!ARCH || !PLATFORM) {
    throw new Error(`Unsupported host for Zig: ${process.platform}/${process.arch}`)
  }

  const binary = zigBinaryPath()
  if (await exists(binary)) return binary

  const key = `${ARCH}-${PLATFORM}`
  const index = await fetch('https://ziglang.org/download/index.json').then((r) => r.json())
  const release = index[ZIG_VERSION]?.[key]
  if (!release) throw new Error(`Zig ${ZIG_VERSION} has no build for ${key}`)

  await fs.mkdir(installRoot, { recursive: true })
  const archive = path.join(installRoot, path.basename(new URL(release.tarball).pathname))

  console.log(`Downloading Zig ${ZIG_VERSION} for ${key}...`)
  const bytes = Buffer.from(await fetch(release.tarball).then((r) => r.arrayBuffer()))

  // The toolchain is an executable we are about to run, so verify it against the
  // shasum ziglang.org publishes alongside the download rather than trusting the pipe.
  const actual = createHash('sha256').update(bytes).digest('hex')
  if (actual !== release.shasum) {
    throw new Error(`Zig checksum mismatch: expected ${release.shasum}, got ${actual}`)
  }

  await fs.writeFile(archive, bytes)
  await extract(archive, installRoot)
  await fs.rm(archive, { force: true })

  if (!(await exists(binary))) throw new Error(`Zig extracted but binary missing at ${binary}`)
  console.log(`Zig installed: ${binary}`)
  return binary
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('setup-zig.mjs')) {
  const binary = await setupZig()
  execFileSync(binary, ['version'], { stdio: 'inherit' })
}
