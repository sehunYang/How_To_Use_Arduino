import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { phase5Recipes } from '.'

const canonicalLabels = [
  'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10',
  'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8',
  'E1', 'E2', 'E3', 'E4', 'E5', 'E6',
  'B1', 'B2', 'B3', 'B4',
  'R1', 'R2', 'R3', 'R4', 'R5', 'R6',
]

describe('Phase 5 L5 harness slots', () => {
  it('keeps one named C++ test slot for every canonical recipe', () => {
    expect(phase5Recipes).toHaveLength(canonicalLabels.length)
    const source = readFileSync('logic/phase5.test.cpp', 'utf8')
    for (const label of canonicalLabels) {
      expect(source, label).toMatch(new RegExp(`TEST_CASE\\("${label} `))
    }
  })
})
