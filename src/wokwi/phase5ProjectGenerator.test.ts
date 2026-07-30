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
  it('generates exactly 32 deterministic projects and excludes only S9/E5', () => {
    const projects = buildPhase5WokwiProjects(eligible, phase5Recipes, sensors)
    const manifest = buildPhase5WokwiManifest(projects, excluded)

    expect(projects).toHaveLength(32)
    expect(manifest.projectCount).toBe(32)
    expect(manifest.exclusions).toEqual(['S9', 'e5-spatial-light-map'])
    expect(new Set(projects.map((project) => project.id)).size).toBe(32)
    expect(projects.some((project) => excluded.includes(project.id))).toBe(false)
  })

  it('renders a build input, diagram, local firmware config, and <=20s scenario command', () => {
    const projects = buildPhase5WokwiProjects(eligible, phase5Recipes, sensors)

    for (const project of projects) {
      expect(project.sketch).toContain(`Serial.println("PHASE5_READY:${project.id}");`)
      expect(project.diagram.author).toBe(project.id)
      expect(project.timeoutMs).toBeLessThanOrEqual(PHASE5_SIMULATION_TIMEOUT_CAP_MS)
      expect(project.command).toBe(
        `wokwi-cli ${project.path} --scenario scenario.test.yaml --timeout ${project.timeoutMs}`,
      )
      expect(renderPhase5WokwiToml(project)).toContain('firmware = "firmware.hex"')
      expect(renderPhase5Scenario(project))
        .toContain(`  - wait-serial: "PHASE5_READY:${project.id}"`)
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
