/**
 * Sketch manifest convention (plan N11): `// @pin`, `// @baud`, `// @tunable`
 * comment lines are the ONLY thing L1 parses out of a sketch. We deliberately
 * do not attempt to parse arbitrary C++ (#define, pinMode, etc.) — that class
 * of parser produces exactly the silent false-negatives/positives the
 * manifest exists to avoid. `CodeBlock` (Phase 3) strips these lines from
 * both the rendered view and the clipboard payload so students never see
 * machine metadata mixed into their code (plan E5a).
 */

const PIN_RE = /^\s*\/\/\s*@pin\s+(\w+)\s*=\s*(\S+)\s*$/
const BAUD_RE = /^\s*\/\/\s*@baud\s+(\d+)\s*$/
const TUNABLE_RE = /^\s*\/\/\s*@tunable\s+(\w[\w.-]*)\s*$/

/** A line counts as "code" if it isn't blank and isn't a `//` comment-only line. */
function isCodeLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.length > 0 && !trimmed.startsWith('//')
}

export interface ParsedManifest {
  pins: Record<string, string>
  baud: number | null
  /** Tunable marker names, in declaration order (duplicates preserved as-is). */
  tunables: string[]
}

export function parseManifest(source: string): ParsedManifest {
  const lines = source.split('\n')
  const pins: Record<string, string> = {}
  let baud: number | null = null
  const tunables: string[] = []

  for (const line of lines) {
    const pinMatch = PIN_RE.exec(line)
    if (pinMatch) {
      pins[pinMatch[1]] = pinMatch[2]
      continue
    }
    const baudMatch = BAUD_RE.exec(line)
    if (baudMatch) {
      baud = Number(baudMatch[1])
      continue
    }
    const tunableMatch = TUNABLE_RE.exec(line)
    if (tunableMatch) {
      tunables.push(tunableMatch[1])
    }
  }

  return { pins, baud, tunables }
}

/**
 * Resolves a `TunableParam.anchor` name to the 1-indexed line number of the
 * next code line following its `// @tunable <anchor>` marker. This is
 * recomputed fresh from the current sketch text every time — never cached —
 * so inserting/reordering comments above it can never desync the anchor from
 * the line it actually highlights (the exact bug raw line numbers had).
 *
 * Returns null (invalid) when the marker appears zero times, more than
 * once, or has no following code line before EOF — all three are L1
 * violations (plan check #11 / PL4).
 */
export function resolveTunableAnchor(source: string, anchor: string): number | null {
  const lines = source.split('\n')
  const markerLineIndexes: number[] = []

  for (let i = 0; i < lines.length; i++) {
    const match = TUNABLE_RE.exec(lines[i])
    if (match && match[1] === anchor) {
      markerLineIndexes.push(i)
    }
  }

  if (markerLineIndexes.length !== 1) return null

  const markerIndex = markerLineIndexes[0]
  for (let i = markerIndex + 1; i < lines.length; i++) {
    if (isCodeLine(lines[i])) {
      return i + 1 // 1-indexed line number
    }
  }

  return null
}
