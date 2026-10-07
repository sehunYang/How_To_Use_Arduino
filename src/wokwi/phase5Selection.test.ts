import { describe, expect, it } from 'vitest'
import { sensors } from '@/data/inventory-seed/sensors'
import { phase5Recipes } from '@/data/phase5'
import { buildPhase5WokwiManifest, buildPhase5WokwiProjects, phase5ProjectFingerprint } from './phase5ProjectGenerator'
import { PHASE5_GLOBAL_INPUTS, selectPhase5Projects, type SelectableProject } from './phase5Selection'
import { phase5SimulationRegistry } from './phase5SimulationRegistry'

const head: SelectableProject[] = [
  { id: 'cooling-curve', chips: [], fingerprint: 'aaaa' },
  { id: 'S6', chips: ['bme280'], fingerprint: 'bbbb' },
  { id: 'plant-growth', chips: ['bme280', 'tsl2591'], fingerprint: 'cccc' },
  { id: 'S8', chips: ['tsl2591'], fingerprint: 'dddd' },
]

describe('Phase 5 PR selection', () => {
  it('runs nothing when no project input moved', () => {
    expect(selectPhase5Projects(['README.md', 'src/pages/Home.tsx'], head, head).ids).toEqual([])
  })

  it('runs the projects whose fingerprint changed or that are new', () => {
    const base = [head[0], { ...head[1], fingerprint: 'old' }, head[3]]
    expect(selectPhase5Projects(['src/data/phase5/e3.ts'], head, base)).toEqual({
      ids: ['S6', 'plant-growth'],
      reasons: { S6: 'sketch, circuit, scenario or expectations changed', 'plant-growth': 'new project' },
    })
  })

  it('runs every project that wires a changed custom chip', () => {
    expect(selectPhase5Projects(['chips/tsl2591.c'], head, head).ids).toEqual(['plant-growth', 'S8'])
    expect(selectPhase5Projects(['chips/bme280.chip.json'], head, head).ids).toEqual(['S6', 'plant-growth'])
  })

  it('runs everything when a shared input changed or the base has no manifest', () => {
    expect(selectPhase5Projects(['src/wokwi/sensorOracles.ts'], head, head).ids).toHaveLength(head.length)
    expect(selectPhase5Projects([], head, undefined).ids).toHaveLength(head.length)
    // A base manifest from before fingerprints existed counts every project as changed.
    const legacy = head.map(({ id, chips }) => ({ id, chips }))
    expect(selectPhase5Projects([], head, legacy).ids).toHaveLength(head.length)
  })

  it('lists shared inputs that exist', async () => {
    const { existsSync } = await import('node:fs')
    for (const path of PHASE5_GLOBAL_INPUTS) expect(existsSync(path), path).toBe(true)
  })
})

describe('Phase 5 project fingerprints', () => {
  const eligible = phase5SimulationRegistry.filter((entry) => entry.eligible)
  const projects = buildPhase5WokwiProjects(eligible, phase5Recipes, sensors)

  it('differ between projects and are recorded in the manifest', () => {
    const manifest = buildPhase5WokwiManifest(projects, [])
    const fingerprints = manifest.projects.map((project) => project.fingerprint)
    expect(new Set(fingerprints).size).toBe(projects.length)
  })

  it('change when a sketch or an expectation changes', () => {
    const project = projects.find((candidate) => candidate.id === 'cooling-curve')!
    const original = phase5ProjectFingerprint(project)
    expect(phase5ProjectFingerprint({ ...project, sketch: `${project.sketch}// edit\n` })).not.toBe(original)
    const spec = project.behavior!
    const looser = { ...spec, sampleInterval: { min: 1.5, max: 2.0 } }
    expect(phase5ProjectFingerprint({ ...project, behavior: looser })).not.toBe(original)
    expect(phase5ProjectFingerprint(project)).toBe(original)
  })
})
