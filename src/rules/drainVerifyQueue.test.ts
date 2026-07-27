import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import type { Recipe } from '@/schema'
import { sensors } from '@/data/inventory-seed/sensors'
import { actuators } from '@/data/inventory-seed/actuators'
import { validateRecipe } from '@/validation/staticCheck'
import { drainVerifyQueue } from '@/verification/drainVerifyQueue'

// US-204: the verifyRequests pre-publish queue drain. security.test.ts
// scenario (8) already proves CI can read+delete a verifyRequests doc it
// did not create; this file adds the CREATE-side proof (admin-only) plus
// the drainVerifyQueue() logic that exercises the whole rule end-to-end.

const PROJECT_ID = 'how-to-use-arduino-test'
const inventory = { sensors, actuators }

// drainVerifyQueue() shells out to the real arduino-cli for L2, which costs a
// few seconds — the same reason compileCheck.test.ts raises its timeout. Left
// at vitest's 5s default this test sits ~1s from the limit and flakes whenever
// the machine is loaded.
const COMPILE_TIMEOUT = 120_000

let testEnv: RulesTestEnvironment

/** Same minimal, fully-clean shape as staticCheck.test.ts's cleanRecipe fixture. */
function validRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'test-recipe',
    type: 'project',
    title: '테스트 레시피',
    subject: '물리',
    difficulty: '중급',
    minutes: 30,
    board: 'uno-r3',
    sensors: ['mpu6050'],
    actuators: ['led'],
    coreKeywords: ['테스트'],
    imageUrl: 'wiring/test.png',
    imageWidth: 800,
    imageHeight: 600,
    wiring: [
      { from: 'MPU6050.SDA', to: 'UNO.A4', color: 'blue', focus: { x: 0, y: 0, w: 10, h: 10 }, text: 'SDA를 A4에 연결하세요' },
      { from: 'MPU6050.SCL', to: 'UNO.A5', color: 'yellow', focus: { x: 20, y: 0, w: 10, h: 10 }, text: 'SCL을 A5에 연결하세요' },
    ],
    sketch: '// @pin SDA=A4\n// @pin SCL=A5\n// @baud 9600\nvoid setup() {}\nvoid loop() {}',
    baudRate: 9600,
    tunables: [],
    body: '테스트 본문입니다.',
    applicationGuide: '응용 가이드입니다.',
    troubleshooting: [{ symptom: '증상', cause: '원인', fix: '해결법' }],
    // E3 (verifyRequests) is by definition a PRE-publish check, so a draft is
    // the realistic fixture; firestore.rules already allows isCI() draft reads.
    status: 'draft',
    reviewedOnDevice: null,
    commentReviewed: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

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
})

describe('verifyRequests create rule (admin-only)', () => {
  it('admin CAN create a verifyRequests doc', async () => {
    const admin = testEnv.authenticatedContext('admin-1', { admin: true })
    await assertSucceeds(
      admin.firestore().collection('verifyRequests').doc('vr-create').set({ requestedAt: new Date() }),
    )
  })

  it('a non-admin, non-CI identity cannot create a verifyRequests doc', async () => {
    const student = testEnv.authenticatedContext('student-1')
    await assertFails(
      student.firestore().collection('verifyRequests').doc('vr-create').set({ requestedAt: new Date() }),
    )
  })
})

describe('drainVerifyQueue (US-204)', () => {
  it(
    'drains a verifyRequests doc: writes simStatus with matching staticIssues and deletes the request',
    async () => {
      const recipe = validRecipe({ id: 'pendulum-like' })

      const admin = testEnv.authenticatedContext('admin-1', { admin: true })
      await assertSucceeds(
        admin.firestore().collection('verifyRequests').doc(recipe.id).set({ requestedAt: new Date() }),
      )
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection('recipes').doc(recipe.id).set(recipe)
      })

      const ci = testEnv.authenticatedContext('ci-1', { ci: true })
      await drainVerifyQueue(ci.firestore(), inventory)

      const simStatusSnap = await ci.firestore().collection('simStatus').doc(recipe.id).get()
      expect(simStatusSnap.exists).toBe(true)
      const expectedStaticIssues = validateRecipe(recipe, inventory, 'publish')
      expect(simStatusSnap.data()?.staticIssues).toEqual(expectedStaticIssues)

      const requestSnap = await ci.firestore().collection('verifyRequests').doc(recipe.id).get()
      expect(requestSnap.exists).toBe(false)
    },
    COMPILE_TIMEOUT,
  )

  it('dequeues a request whose recipe no longer exists instead of wedging on it', async () => {
    const admin = testEnv.authenticatedContext('admin-1', { admin: true })
    await assertSucceeds(
      admin.firestore().collection('verifyRequests').doc('deleted-recipe').set({ requestedAt: new Date() }),
    )

    const ci = testEnv.authenticatedContext('ci-1', { ci: true })
    await expect(drainVerifyQueue(ci.firestore(), inventory)).resolves.toBeUndefined()

    const requestSnap = await ci.firestore().collection('verifyRequests').doc('deleted-recipe').get()
    expect(requestSnap.exists).toBe(false)

    const simStatusSnap = await ci.firestore().collection('simStatus').doc('deleted-recipe').get()
    expect(simStatusSnap.exists).toBe(false)
  })

  it('is a no-op that completes without error when verifyRequests is empty', async () => {
    const ci = testEnv.authenticatedContext('ci-1', { ci: true })
    await expect(drainVerifyQueue(ci.firestore(), inventory)).resolves.toBeUndefined()
  })
})
