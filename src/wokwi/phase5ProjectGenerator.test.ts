import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sensors } from '@/data/inventory-seed/sensors'
import { phase5Recipes } from '@/data/phase5'
import { phase6Recipes } from '@/data/phase6'
import { phase7Recipes } from '@/data/phase7'
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
  simulationPhases,
} from './phase5SimulationRegistry'
import { phase5BehaviorSpecs } from './behaviorSpecs'

const eligible = phase5SimulationRegistry.filter((entry) => entry.eligible)
const excluded = phase5SimulationRegistry
  .filter((entry) => !entry.eligible)
  .map((entry) => entry.recipeId)

describe('Phase 5 Wokwi project generation', () => {
  it('generates deterministic projects for every simulation-eligible recipe', () => {
    const projects = buildPhase5WokwiProjects(eligible, phase5Recipes, sensors)
    const manifest = buildPhase5WokwiManifest(projects, excluded)

    expect(projects).toHaveLength(34)
    expect(manifest.projectCount).toBe(34)
    expect(manifest.exclusions).toEqual([])
    expect(new Set(projects.map((project) => project.id)).size).toBe(34)
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
    expect(behaviorProjects.map((project) => project.id).sort()).toEqual(
      phase5BehaviorSpecs.map((spec) => spec.recipeId).sort(),
    )

    for (const project of behaviorProjects) {
      const recipe = phase5Recipes.find((candidate) => candidate.id === project.id)!
      expect(project.sketch).toBe(`${recipe.sketch.trimEnd()}\n`)
      expect(project.sketch).not.toContain('PHASE5_READY')

      const scenario = renderPhase5Scenario(project)
      expect(scenario).toContain(`  - wait-serial: ${JSON.stringify(project.behavior!.header)}`)
      for (const step of project.behavior!.phases.flatMap((phase) => phase.steps)) {
        if ('set' in step) {
          expect(scenario).toContain(`      control: ${step.set.control}\n      value: ${step.set.value}`)
        }
        if ('waitSerial' in step) expect(scenario).toContain(`  - wait-serial: ${JSON.stringify(step.waitSerial)}`)
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

describe('Phase 6 and 7 Wokwi project generation', () => {
  for (const { phase, root, recipes, registry } of simulationPhases.filter((candidate) => candidate.phase !== 'phase5')) {
    it(`keeps the committed ${phase} tree complete and current`, () => {
      const projects = buildPhase5WokwiProjects(registry.filter((entry) => entry.eligible), recipes, sensors, root)
      const directories = readdirSync(resolve(root), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
      expect(directories).toEqual(projects.map((project) => project.id).sort())
      for (const project of projects) {
        expect(project.path).toBe(`${root}/${project.id}`)
        expect(project.timeoutMs).toBeLessThanOrEqual(PHASE5_SIMULATION_TIMEOUT_CAP_MS)
        const projectRoot = resolve(project.path)
        expect(readFileSync(resolve(projectRoot, 'scenario.test.yaml'), 'utf8')).toBe(renderPhase5Scenario(project))
        expect(readFileSync(resolve(projectRoot, `${project.id}.ino`), 'utf8')).toBe(project.sketch)
        if (project.behavior) expect(project.sketch).not.toContain('PHASE5_READY')
      }
    })
  }
})

describe('simulation stand-ins for parts Wokwi lacks', () => {
  const allRecipes = [...phase5Recipes, ...phase6Recipes, ...phase7Recipes]
  const project = (id: string) => {
    const entry = simulationPhases.flatMap((phase) => phase.registry).find((candidate) => candidate.recipeId === id)
    if (!entry?.eligible) throw new Error(`${id} is not simulatable`)
    return buildPhase5WokwiProjects([entry], allRecipes, sensors)[0]
  }

  it('drives each CdS divider from a chip told which leg is the analog node', () => {
    const parts = project('light-follow-car').diagram.parts.filter((part) => part.type === 'chip-cds')
    expect(parts.map((part) => [part.id, part.attrs])).toEqual([
      ['cds_1', { nodePin: '2', fixedOhms: '10000', supplyVolts: '5' }],
      ['cds_2', { nodePin: '2', fixedOhms: '10000', supplyVolts: '5' }],
    ])
    expect(project('light-follow-car').chips).toEqual(['cds'])
  })

  it('folds the TSL2591s behind a TCA9548A into the switch chip', () => {
    const { diagram, chips } = project('S9')
    expect(diagram.parts.find((part) => part.id === 'tca9548a')).toMatchObject({ type: 'chip-tca9548a', attrs: { address: '112', tslMask: '3' } })
    expect(diagram.parts.some((part) => part.type === 'chip-tsl2591')).toBe(false)
    expect(diagram.connections.some(([from, to]) => /^tsl2591/.test(from) || /^tsl2591/.test(to))).toBe(false)
    expect(chips).toEqual(['tca9548a'])
  })

  it('moves a TSL2591 on the MPU6050 auxiliary bus into the MPU chip', () => {
    const { diagram, chips } = project('s13-mpu-aux-tsl2591')
    expect(diagram.parts.find((part) => part.id === 'mpu6050')).toMatchObject({ type: 'chip-mpu6050aux', attrs: { tslOnAux: '1' } })
    expect(diagram.parts.some((part) => part.type === 'chip-tsl2591')).toBe(false)
    expect(chips).toEqual(['mpu6050aux'])
    // MPU6050s with nothing on XDA/XCL keep Wokwi's own part.
    expect(project('s12-dual-mpu6050-address').diagram.parts.filter((part) => part.type === 'wokwi-mpu6050')).toHaveLength(2)
  })

  it('charges the RC branch inside the INA219 chip, taking R and C from the recipe', () => {
    const { diagram, chips } = project('ph21-rc-time-constant')
    expect(diagram.parts.find((part) => part.id === 'ina219')).toMatchObject({
      type: 'chip-ina219rc',
      attrs: { sourceVolts: '5', seriesOhms: '1000', capacitanceUf: '1000' },
    })
    expect(chips).toEqual(['ina219rc'])
    // ph17's capacitor is a PWM filter ahead of the INA219, not a branch it measures.
    expect(project('ph17-ohms-law').chips).toEqual(['ina219'])
  })

  it('reads the switch address from the A0-A2 straps', () => {
    const muxes = project('s14-tca-address-reset').diagram.parts.filter((part) => part.type === 'chip-tca9548a')
    expect(muxes.map((part) => part.attrs?.address)).toEqual(['112', '113'])
  })
})
