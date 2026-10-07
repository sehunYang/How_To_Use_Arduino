import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sensors } from '@/data/inventory-seed/sensors'
import { phase5Recipes } from '@/data/phase5'
import {
  buildPhase5WokwiManifest,
  buildPhase5WokwiProjects,
  PHASE5_WOKWI_ROOT,
  renderPhase5Scenario,
  renderPhase5WokwiToml,
} from './phase5ProjectGenerator'
import {
  PHASE5_SIMULATION_TIMEOUT_CAP_MS,
  phase5SimulationRegistry,
} from './phase5SimulationRegistry'

const eligible = phase5SimulationRegistry.filter((entry) => entry.eligible)
const excluded = phase5SimulationRegistry
  .filter((entry) => !entry.eligible)
  .map((entry) => entry.recipeId)

describe('Phase 5 Wokwi project generation', () => {
  it('generates deterministic projects for every simulation-eligible recipe', () => {
    const projects = buildPhase5WokwiProjects(eligible, phase5Recipes, sensors)
    const manifest = buildPhase5WokwiManifest(projects, excluded)

    expect(projects).toHaveLength(28)
    expect(manifest.projectCount).toBe(28)
    expect(manifest.exclusions).toEqual([
      'S4',
      'S9',
      'e5-spatial-light-map',
      'night-activity',
      'light-follow-car',
      'smart-lighting',
    ])
    expect(new Set(projects.map((project) => project.id)).size).toBe(28)
    expect(projects.some((project) => excluded.includes(project.id))).toBe(false)
  })

  it('renders a build input, diagram, local firmware config, and <=20s scenario command', () => {
    const projects = buildPhase5WokwiProjects(eligible, phase5Recipes, sensors)

    for (const project of projects) {
      expect(project.diagram.author).toBe(project.id)
      expect(project.timeoutMs).toBeLessThanOrEqual(PHASE5_SIMULATION_TIMEOUT_CAP_MS)
      expect(project.command).toBe(
        `wokwi-cli ${project.path} --scenario scenario.test.yaml --timeout ${project.timeoutMs}`,
      )
      expect(renderPhase5WokwiToml(project)).toContain('firmware = "firmware.hex"')
      if (project.behavior) continue
      expect(project.sketch).toContain(`Serial.println("# PHASE5_READY:${project.id}");`)
      expect(renderPhase5Scenario(project))
        .toContain(`  - wait-serial: "# PHASE5_READY:${project.id}"`)
    }
  })

  it('runs behaviour projects on the unmodified student sketch with every stimulus', () => {
    const projects = buildPhase5WokwiProjects(eligible, phase5Recipes, sensors)
    const behaviorProjects = projects.filter((project) => project.behavior)
    expect(behaviorProjects.map((project) => project.id)).toEqual(['cooling-curve'])

    for (const project of behaviorProjects) {
      const recipe = phase5Recipes.find((candidate) => candidate.id === project.id)!
      expect(project.sketch).toBe(`${recipe.sketch.trimEnd()}\n`)
      expect(project.sketch).not.toContain('PHASE5_READY')

      const partIds = new Set(project.diagram.parts.map((part) => part.id))
      const scenario = renderPhase5Scenario(project)
      expect(scenario).toContain(`  - wait-serial: ${JSON.stringify(project.behavior!.header)}`)
      for (const stimulus of project.behavior!.stimuli) {
        expect(partIds.has(stimulus.partId), stimulus.partId).toBe(true)
        expect(scenario).toContain(`      value: ${stimulus.value}\n  - wait-serial: ${JSON.stringify(stimulus.expectSerial)}`)
      }
    }
  })

  it('keeps the committed generated tree complete and current', () => {
    const projects = buildPhase5WokwiProjects(eligible, phase5Recipes, sensors)
    const directories = readdirSync(resolve(PHASE5_WOKWI_ROOT), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()

    expect(directories).toEqual(projects.map((project) => project.id).sort())
    for (const project of projects) {
      const root = resolve(project.path)
      expect(JSON.parse(readFileSync(resolve(root, 'diagram.json'), 'utf8'))).toEqual(project.diagram)
      expect(readFileSync(resolve(root, 'wokwi.toml'), 'utf8')).toBe(renderPhase5WokwiToml(project))
      expect(readFileSync(resolve(root, 'scenario.test.yaml'), 'utf8')).toBe(renderPhase5Scenario(project))
      expect(readFileSync(resolve(root, `${project.id}.ino`), 'utf8')).toBe(project.sketch)
    }
  })
})
