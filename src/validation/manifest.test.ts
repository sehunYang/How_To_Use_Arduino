import { describe, it, expect } from 'vitest'
import { parseManifest, resolveTunableAnchor } from './manifest'

const basicSketch = `#include <Wire.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600
// @tunable threshold

void setup() {
  Serial.begin(9600);
}

void loop() {
}
`

describe('parseManifest', () => {
  it('extracts pins, baud, and tunable names', () => {
    const result = parseManifest(basicSketch)
    expect(result.pins).toEqual({ SDA: 'A4', SCL: 'A5' })
    expect(result.baud).toBe(9600)
    expect(result.tunables).toEqual(['threshold'])
  })

  it('returns empty/null values for a sketch with no manifest', () => {
    const result = parseManifest('void setup() {}\nvoid loop() {}\n')
    expect(result.pins).toEqual({})
    expect(result.baud).toBeNull()
    expect(result.tunables).toEqual([])
  })
})

describe('resolveTunableAnchor', () => {
  const multiTunableSketch = `// @pin TRIG=D9
// @pin ECHO=D10
// @baud 9600

// This is the sampling interval, keep it short relative to the pendulum period
// @tunable samplingIntervalMs
int samplingIntervalMs = 10;

// A comment explaining the threshold below, added after the marker
// on purpose to prove line-number shift doesn't break resolution
//
//
// @tunable threshold
int threshold = 50;

void setup() {
  // @tunable startDelay
  // another unrelated comment line right after the marker
  int startDelay = 200;
}
`

  it('resolves each of 3+ markers to the correct next-code-line, surviving interspersed comments', () => {
    const samplingLine = resolveTunableAnchor(multiTunableSketch, 'samplingIntervalMs')
    const thresholdLine = resolveTunableAnchor(multiTunableSketch, 'threshold')
    const startDelayLine = resolveTunableAnchor(multiTunableSketch, 'startDelay')

    const lines = multiTunableSketch.split('\n')
    expect(samplingLine).not.toBeNull()
    expect(lines[samplingLine! - 1]).toContain('int samplingIntervalMs = 10;')

    expect(thresholdLine).not.toBeNull()
    expect(lines[thresholdLine! - 1]).toContain('int threshold = 50;')

    expect(startDelayLine).not.toBeNull()
    expect(lines[startDelayLine! - 1]).toContain('int startDelay = 200;')
  })

  it('resolution is stable when unrelated comment lines are inserted above the marker', () => {
    const before = resolveTunableAnchor(multiTunableSketch, 'threshold')

    // Insert 3 more unrelated comment lines above the `threshold` marker —
    // a raw line-number anchor would now point at the wrong line; the
    // marker-based anchor must still resolve to the same *relative* target
    // (its own next code line), proving it survives edits above it.
    const edited = multiTunableSketch.replace(
      '// @tunable threshold',
      '// one more note\n// another note\n// yet another note\n// @tunable threshold',
    )
    const after = resolveTunableAnchor(edited, 'threshold')

    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    expect(after).toBe(before! + 3) // shifted by exactly the 3 inserted lines
    const editedLines = edited.split('\n')
    expect(editedLines[after! - 1]).toContain('int threshold = 50;')
  })

  it('returns null when the marker does not exist', () => {
    expect(resolveTunableAnchor(multiTunableSketch, 'doesNotExist')).toBeNull()
  })

  it('returns null when the marker appears more than once (ambiguous)', () => {
    const duplicated = `// @tunable dup\nint a = 1;\n// @tunable dup\nint b = 2;\n`
    expect(resolveTunableAnchor(duplicated, 'dup')).toBeNull()
  })

  it('returns null when the marker has no following code line before EOF', () => {
    const trailing = `int a = 1;\n// @tunable trailing\n// just a comment\n\n`
    expect(resolveTunableAnchor(trailing, 'trailing')).toBeNull()
  })
})
