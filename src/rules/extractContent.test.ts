import { afterAll, beforeAll, beforeEach, describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import type { Recipe } from '@/schema'
import { sensors } from '@/data/inventory-seed/sensors'
import { pendulumRecipe } from '@/data/canary/pendulum'
import { multiTsl2591Recipe } from '@/data/canary/multiTsl2591'
import { buildDiagram } from '@/wokwi/buildDiagram'
import { extractContent } from '@/verification/extractContent'

// Integration test for US-202's content-extraction pipeline, reusing the
// same emulator boilerplate as security.test.ts (PL2). Confirms the
// pipeline's read-access semantics (published readable anonymously, draft
// only via CI) and that extractContent's output matches the fixtures and
// US-201's buildDiagram exactly.

const PROJECT_ID = 'how-to-use-arduino-test'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
    storage: {
      rules: readFileSync('storage.rules', 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.clearStorage()
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('recipes').doc('pendulum').set(pendulumRecipe)
    await ctx.firestore().collection('recipes').doc('multi-tsl2591').set({ ...multiTsl2591Recipe, status: 'draft' })
  })
})

describe('extractContent pipeline (US-202)', () => {
  it('a published recipe is readable by an unauthenticated client', async () => {
    const unauth = testEnv.unauthenticatedContext()
    await assertSucceeds(unauth.firestore().collection('recipes').doc('pendulum').get())
  })

  it('a draft recipe is denied to unauthenticated reads and allowed for the CI identity', async () => {
    const unauth = testEnv.unauthenticatedContext()
    await assertFails(unauth.firestore().collection('recipes').doc('multi-tsl2591').get())

    const ci = testEnv.authenticatedContext('ci-1', { ci: true })
    await assertSucceeds(ci.firestore().collection('recipes').doc('multi-tsl2591').get())
  })

  it('round-trips both canary recipes through extractContent, matching the fixture sketch and US-201 buildDiagram output', async () => {
    const ci = testEnv.authenticatedContext('ci-1', { ci: true })

    for (const fixture of [pendulumRecipe, multiTsl2591Recipe]) {
      const snap = await ci.firestore().collection('recipes').doc(fixture.id).get()
      const recipe = snap.data() as Recipe

      const result = extractContent(recipe, sensors)

      expect(result.sketchFilename).toBe(`${fixture.id}.ino`)
      expect(result.sketchContent).toBe(fixture.sketch)
      expect(result.diagram).toEqual(buildDiagram(recipe, sensors))
    }
  })
})
