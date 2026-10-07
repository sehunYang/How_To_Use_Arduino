import { describe, expect, it } from 'vitest'
import { sensors } from '@/data/inventory-seed/sensors'
import { phase5Recipes } from '@/data/phase5'
import { buildDiagram } from './buildDiagram'
import { phase5BehaviorSpecById, phase5BehaviorSpecs, type Phase5BehaviorSpec } from './behaviorSpecs'
import { checkSerialBehavior, serialFromCliOutput } from './serialBehavior'

const cooling = phase5BehaviorSpecById.get('cooling-curve')!

const goodLog = [
  'time_s,temperature_c,excess_temperature_c',
  '0.8,22.000,0.000',
  '2.6,60.000,38.000',
  '4.4,45.000,23.000',
  '6.1,30.000,8.000',
  '7.9,22.500,0.500',
  '',
].join('\r\n')

describe('serial behaviour checker', () => {
  it('accepts a log that follows every stimulus', () => {
    expect(checkSerialBehavior(cooling, goodLog)).toEqual({ ok: true, rows: 5, failures: [] })
  })

  it('tolerates a lagging row that still reports the previous stimulus', () => {
    const log = goodLog.replace('4.4,45.000,23.000', '4.4,60.000,38.000\n6.2,45.000,23.000')
      .replace('6.1,30.000', '8.0,30.000').replace('7.9,22.500', '9.8,22.500')
    expect(checkSerialBehavior(cooling, log).ok).toBe(true)
  })

  it('rejects a missing header', () => {
    expect(checkSerialBehavior(cooling, goodLog.replace('time_s,', 'time,')).failures)
      .toEqual(['header "time_s,temperature_c,excess_temperature_c" never printed'])
  })

  it('rejects nan rows from a disconnected sensor', () => {
    const result = checkSerialBehavior(cooling, goodLog.replace('4.4,45.000,23.000', '4.4,nan,nan'))
    expect(result.failures).toContain('line 3 "4.4,nan,nan": temperature_c is not a number')
  })

  it('rejects the DS18B20 85 °C power-on value', () => {
    const result = checkSerialBehavior(cooling, goodLog.replace('4.4,45.000,23.000', '4.4,85.000,63.000'))
    expect(result.failures.some((failure) => failure.includes('fits no phase'))).toBe(true)
  })

  it('rejects a wrong derived column', () => {
    const result = checkSerialBehavior(cooling, goodLog.replace('2.6,60.000,38.000', '2.6,60.000,60.000'))
    expect(result.failures).toContain('line 2 "2.6,60.000,60.000": excess_temperature_c=60, expected 38±0.002')
  })

  it('rejects readings that go back to an earlier stimulus', () => {
    const result = checkSerialBehavior(cooling, goodLog.replace('6.1,30.000,8.000', '6.1,60.000,38.000'))
    expect(result.ok).toBe(false)
  })

  it('rejects a sampling interval far from the recipe loop', () => {
    const result = checkSerialBehavior(cooling, goodLog.replace('4.4,', '9.4,'))
    expect(result.failures.some((failure) => failure.includes('time_s step'))).toBe(true)
  })

  it('rejects a log that never reached the last stimulus', () => {
    const result = checkSerialBehavior(cooling, goodLog.replace('7.9,22.500,0.500\r\n', ''))
    expect(result.failures).toContain('phase "ds18b20 at 22.5 °C" never observed')
  })

  it('rejects sensor-error diagnostics before or after the header', () => {
    expect(checkSerialBehavior(cooling, `# BME280_ERROR\n${goodLog}`).failures)
      .toEqual(['unexpected diagnostic before header: "# BME280_ERROR"'])
    expect(checkSerialBehavior(cooling, goodLog.replace('4.4,', '# sensor-error\n4.4,')).failures)
      .toEqual(['line 3 "# sensor-error": unexpected diagnostic'])
  })

  const stepSpec: Phase5BehaviorSpec = {
    recipeId: 'fixture',
    header: 'time_ms,level,state',
    textColumns: ['state'],
    allowedComments: ['# warming up'],
    timeColumn: 'time_ms',
    sampleInterval: { min: 100, max: 100 },
    phases: [
      { label: 'low', steps: [], expect: { level: { approx: 0, tolerance: 0 }, state: { text: 'off' } } },
      {
        label: 'high',
        steps: [],
        expect: { level: { approx: 10, tolerance: 0 }, state: { text: 'on' } },
        settleRows: 1,
        sampleInterval: { min: 50, max: 50 },
      },
    ],
    checkRows: (rows) => (rows.length % 2 === 0 ? [] : ['odd row count']),
    minRows: 2,
  }

  it('lets a phase absorb its settle rows and pace its own intervals', () => {
    const log = ['# warming up', 'time_ms,level,state', '0,0,off', '100,5,on', '200,10,on', '250,10,on'].join('\n')
    expect(checkSerialBehavior(stepSpec, log)).toEqual({ ok: true, rows: 4, failures: [] })
  })

  it('does not spend settle rows before the first phase is reached', () => {
    const log = ['time_ms,level,state', '0,0,on', '100,0,off', '200,10,on', '250,10,on'].join('\n')
    expect(checkSerialBehavior(stepSpec, log).failures).toEqual([
      'line 1 "0,0,on": fits no phase from "low" on (state="on", expected "off")',
    ])
  })

  it('reports extra transition rows and cross-row invariants', () => {
    // One settle row is allowed between "low" and "high"; the second one is not.
    const log = ['time_ms,level,state', '0,0,off', '100,5,on', '200,6,on', '300,10,on', '350,10,on'].join('\n')
    expect(checkSerialBehavior(stepSpec, log).failures).toEqual([
      'line 3 "200,6,on": fits no phase from "low" on (level=6, expected 0±0; state="on", expected "off")',
      'odd row count',
    ])
  })
})

describe('wokwi-cli stdout extraction', () => {
  it('recovers the serial log from a real CI run', () => {
    // Captured from GitHub Actions run 37560501332 (wokwi-cli v0.28.1).
    const stdout = [
      'Wokwi CLI v0.28.1 (7cf4ffaebfd8)',
      'Connected to Wokwi Simulation API 1.0.0-20261006-g9494a200',
      'Starting simulation...',
      'time_s,temperature_c,excess_temperature_c',
      '[Phase 5 behavior - cooling-curve] Expected text matched: "time_s,temperature_c,excess_temperature_c"',
      '0.8,22.000,0.000',
      '[Phase 5 behavior - cooling-curve] Expected text matched: ",22.000,0.000"',
      '2.5,60.000,38.000',
      '[Phase 5 behavior - cooling-curve] Expected text matched: ",60.000,38.000"',
      '4.3,45.000,23.000',
      '[Phase 5 behavior - cooling-curve] Expected text matched: ",45.000,23.000"',
      '6.0,30.000,8.000',
      '[Phase 5 behavior - cooling-curve] Expected text matched: ",30.000,8.000"',
      '7.8,22.500,0.500',
      '[Phase 5 behavior - cooling-curve] Expected text matched: ",22.500,0.500"',
      '[Phase 5 behavior - cooling-curve] Scenario completed successfully',
      '',
    ].join('\n')
    expect(checkSerialBehavior(cooling, serialFromCliOutput(stdout))).toEqual({ ok: true, rows: 5, failures: [] })
  })
})

describe('behaviour specs', () => {
  it('cover distinct recipes and match the sketches they claim to test', () => {
    expect(new Set(phase5BehaviorSpecs.map((spec) => spec.recipeId)).size).toBe(phase5BehaviorSpecs.length)
    for (const spec of phase5BehaviorSpecs) {
      const recipe = phase5Recipes.find((candidate) => candidate.id === spec.recipeId)
      expect(recipe, spec.recipeId).toBeDefined()
      expect(recipe!.sketch, spec.recipeId).toContain(`Serial.println("${spec.header}");`)
    }
  })

  it('only drive parts that exist in the recipe circuit', () => {
    for (const spec of phase5BehaviorSpecs) {
      const recipe = phase5Recipes.find((candidate) => candidate.id === spec.recipeId)!
      const partIds = new Set(buildDiagram(recipe, sensors).parts.map((part) => part.id))
      for (const step of [...spec.phases.flatMap((phase) => phase.steps), ...(spec.finalSteps ?? [])]) {
        if ('set' in step) expect(partIds.has(step.set.partId), `${spec.recipeId}: ${step.set.partId}`).toBe(true)
        if ('expectPin' in step) {
          expect(partIds.has(step.expectPin.partId), `${spec.recipeId}: ${step.expectPin.partId}`).toBe(true)
        }
      }
    }
  })

  it('only expect columns the header declares', () => {
    for (const spec of phase5BehaviorSpecs) {
      const columns = new Set(spec.header.split(','))
      const used = [
        ...Object.keys(spec.always ?? {}),
        ...spec.phases.flatMap((phase) => Object.keys(phase.expect)),
        ...(spec.timeColumn ? [spec.timeColumn] : []),
        ...(spec.textColumns ?? []),
      ]
      for (const column of used) expect(columns.has(column), `${spec.recipeId}: ${column}`).toBe(true)
    }
  })

  it('keep the cooling-curve oracle on the recipe default ambient temperature', () => {
    const recipe = phase5Recipes.find((candidate) => candidate.id === 'cooling-curve')!
    expect(recipe.sketch).toContain('float ambientTemperatureC = 22.0;')
  })

  it('give every probe on a shared 1-Wire bus its own ROM ID', () => {
    const recipe = phase5Recipes.find((candidate) => candidate.id === 'e6-multi-point-temperature')!
    const probes = buildDiagram(recipe, sensors).parts.filter((part) => part.type === 'wokwi-ds18b20')
    expect(probes).toHaveLength(3)
    expect(new Set(probes.map((probe) => probe.attrs?.deviceID)).size).toBe(3)
  })
})
