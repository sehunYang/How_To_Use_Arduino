import { describe, expect, it } from 'vitest'
import { phase5Recipes } from '@/data/phase5'
import { followsWindows, levelInputs, parseTrace, pirOutput, pulses, reactsWithin } from './sketchHost'
import { sketchHostSpecs } from './sketchHostSpecs'

const row = (time_ms: number, value: number) => ({ cells: {}, values: { time_ms, motion: value } })

describe('HC-SR501 output model', () => {
  it('holds OUT high for the hold time after motion stops', () => {
    expect(pirOutput([[1000, 2000]])).toEqual([[1000, 5000]])
  })

  it('extends one detection while motion retriggers it', () => {
    expect(pirOutput([[1000, 2000], [4000, 4500]])).toEqual([[1000, 7500]])
  })

  it('ignores motion during the 2.5 s block time after OUT falls', () => {
    expect(pirOutput([[1000, 2000], [6000, 7000]])).toEqual([[1000, 5000]])
    expect(pirOutput([[1000, 2000], [6000, 9000]])).toEqual([[1000, 5000], [7500, 12000]])
  })

  it('becomes host input arguments', () => {
    expect(levelInputs('D2', [[1000, 5000]])).toEqual(['D2@1000=1', 'D2@5000=0'])
  })
})

describe('host run checks', () => {
  it('compare rows with windows, skipping rows at an edge', () => {
    const check = followsWindows('motion', [[1000, 2000]], 50)
    expect(check([row(500, 0), row(1020, 0), row(1500, 1), row(2500, 0)])).toEqual([])
    expect(check([row(1500, 0)])).toEqual(['time_ms 1500: motion 0, expected 1'])
  })

  it('flag a change reported too late', () => {
    expect(reactsWithin('motion', [[1000, 2000]], 50)([row(1200, 1), row(2010, 0)])).toEqual([
      'motion became 1 200 ms after 1000 ms, more than 50 ms',
    ])
  })

  it('read pulse widths from the trace', () => {
    const edges = parseTrace('100,9,1\n644,9,0\n20100,9,1\n21572,9,0\nnoise\n')
    expect(pulses(edges, 9)).toEqual([[100, 544], [20100, 1472]])
  })
})

describe('host run specs', () => {
  it('name real recipes and edits that apply to their sketches', () => {
    const recipes = new Map(phase5Recipes.map((recipe) => [recipe.id, recipe]))
    for (const spec of sketchHostSpecs) {
      const sketch = recipes.get(spec.recipeId)?.sketch
      expect(sketch, spec.recipeId).toBeDefined()
      expect(sketch).toContain(spec.behavior.header)
      for (const edit of spec.sketchEdits ?? []) expect(sketch!.split(edit.from), edit.from).toHaveLength(2)
    }
  })
})
