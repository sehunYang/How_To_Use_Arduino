import { describe, it, expect } from 'vitest'
import type { Recipe, Sensor, Actuator, SensorRationale } from '@/schema'
import { validateCorpus } from './corpusCheck'

const sensorA: Sensor = {
  id: 'sensor-a',
  name: 'Sensor A',
  interface: 'analog',
  addressing: { mode: 'none' },
  pins: [{ name: 'OUT', kind: 'analog' }],
  currentDrawMa: 1,
  wokwi: { part: 'wokwi-sensor-a', pinMap: {}, simSupported: true },
  muxChannels: 0,
}

const sensorB: Sensor = {
  id: 'sensor-b',
  name: 'Sensor B',
  interface: 'analog',
  addressing: { mode: 'none' },
  pins: [{ name: 'OUT', kind: 'analog' }],
  currentDrawMa: 1,
  wokwi: { part: 'wokwi-sensor-b', pinMap: {}, simSupported: true },
  muxChannels: 0,
}

const actuators: Actuator[] = []
const inventory = { sensors: [sensorA, sensorB], actuators }

function makeRecipe(overrides: Partial<Recipe>): Recipe {
  return {
    id: 'r',
    type: 'project',
    title: 'title',
    subject: '물리',
    difficulty: '중급',
    minutes: 30,
    board: 'uno-r3',
    sensors: [],
    actuators: [],
    coreKeywords: [],
    imageUrl: 'wiring/x.png',
    imageWidth: 800,
    imageHeight: 600,
    wiring: [],
    sketch: 'void setup() {}\nvoid loop() {}',
    baudRate: 9600,
    tunables: [],
    body: 'body',
    applicationGuide: '',
    troubleshooting: [],
    status: 'published',
    reviewedOnDevice: null,
    commentReviewed: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('validateCorpus — violations present', () => {
  // r1: published sensor-example using sensor-a in 물리
  // r2: published project using sensor-b in 물리 (no sensor-example for sensor-b)
  // r3: DRAFT project using sensor-a in 화학·환경 (still "reachable" per 9c, but not counted for 9a's published-only distribution)
  const recipes: Recipe[] = [
    makeRecipe({ id: 'r1', type: 'sensor-example', subject: '물리', sensors: ['sensor-a'], status: 'published' }),
    makeRecipe({ id: 'r2', type: 'project', subject: '물리', sensors: ['sensor-b'], status: 'published' }),
    makeRecipe({ id: 'r3', type: 'project', subject: '화학·환경', sensors: ['sensor-a'], status: 'draft' }),
  ]

  const rationales: SensorRationale[] = [{ sensorId: 'sensor-a', subject: '물리', whyText: '이유 A' }]

  it('9a: flags a subject under its target distribution', () => {
    const issues = validateCorpus(recipes, inventory, { 물리: 2, '화학·환경': 1 }, rationales)
    const subjectIssues = issues.filter((i) => i.code === 'subject-distribution')
    expect(subjectIssues).toHaveLength(1)
    expect(subjectIssues[0].message).toContain('화학·환경')
    expect(subjectIssues[0].severity).toBe('error')
  })

  it('9b: flags an inventory sensor with zero sensor-example recipes', () => {
    const issues = validateCorpus(recipes, inventory, {}, rationales)
    const coverageIssues = issues.filter((i) => i.code === 'sensor-missing-example')
    expect(coverageIssues).toHaveLength(1)
    expect(coverageIssues[0].message).toContain('sensor-b')
  })

  it('9c: flags reachable (sensor, subject) pairs with no rationale', () => {
    const issues = validateCorpus(recipes, inventory, {}, rationales)
    const rationaleIssues = issues.filter((i) => i.code === 'missing-rationale')
    // (sensor-b, 물리) from r2 and (sensor-a, 화학·환경) from r3 both lack a rationale.
    expect(rationaleIssues).toHaveLength(2)
    const messages = rationaleIssues.map((i) => i.message).join(' | ')
    expect(messages).toContain('sensor-b')
    expect(messages).toContain('화학·환경')
  })
})

describe('validateCorpus — fully satisfied corpus', () => {
  const recipes: Recipe[] = [
    makeRecipe({ id: 'r1', type: 'sensor-example', subject: '물리', sensors: ['sensor-a'], status: 'published' }),
    makeRecipe({ id: 'r2', type: 'sensor-example', subject: '물리', sensors: ['sensor-b'], status: 'published' }),
  ]

  const rationales: SensorRationale[] = [
    { sensorId: 'sensor-a', subject: '물리', whyText: '이유 A' },
    { sensorId: 'sensor-b', subject: '물리', whyText: '이유 B' },
  ]

  it('produces zero issues when distribution, coverage, and rationale are all satisfied', () => {
    const issues = validateCorpus(recipes, inventory, { 물리: 2 }, rationales)
    expect(issues).toEqual([])
  })
})
