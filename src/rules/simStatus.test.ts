import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import type { SimStatus } from '@/schema'
import { writeSimStatus } from '@/verification/writeSimStatus'

// Rule + writer-code unit tests for US-203. The `simStatus/{recipeId}` PL2
// rule itself (allow read: if true; allow write: if isCI()) already exists
// and is proven from the rule's own perspective in security.test.ts — this
// file proves the writer code path that exercises it, plus PL11 parallel
// per-recipe-document write isolation.

const PROJECT_ID = 'how-to-use-arduino-test'

let testEnv: RulesTestEnvironment

function validSimStatus(overrides: Partial<SimStatus> = {}): SimStatus {
  return {
    verifyHash: 'hash-abc123',
    compilePass: true,
    simPass: null,
    logicPass: true,
    staticIssues: [],
    verifiedAt: new Date().toISOString(),
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

describe('simStatus writer (US-203 / PL2 write path)', () => {
  it('CI identity write via writeSimStatus succeeds and reads back correctly', async () => {
    const ci = testEnv.authenticatedContext('ci-1', { ci: true })
    const status = validSimStatus({ verifyHash: 'pendulum-hash' })

    await assertSucceeds(writeSimStatus(ci.firestore(), 'pendulum', status))

    const snap = await ci.firestore().collection('simStatus').doc('pendulum').get()
    expect(snap.exists).toBe(true)
    expect(snap.data()).toEqual(status)
  })

  it('unauthenticated direct write to simStatus is denied', async () => {
    const unauth = testEnv.unauthenticatedContext()
    await assertFails(
      unauth.firestore().collection('simStatus').doc('pendulum').set(validSimStatus()),
    )
  })

  it('authenticated non-admin-non-ci direct write to simStatus is denied', async () => {
    const student = testEnv.authenticatedContext('student-1')
    await assertFails(
      student.firestore().collection('simStatus').doc('pendulum').set(validSimStatus()),
    )
  })

  it('admin without the ci claim direct write to simStatus is denied', async () => {
    const admin = testEnv.authenticatedContext('admin-1', { admin: true })
    await assertFails(
      admin.firestore().collection('simStatus').doc('pendulum').set(validSimStatus()),
    )
  })

  it('PL11: two concurrent writeSimStatus calls for different recipeIds do not clobber each other', async () => {
    const ci = testEnv.authenticatedContext('ci-1', { ci: true })

    const pendulumStatus = validSimStatus({
      verifyHash: 'pendulum-hash-v1',
      compilePass: true,
      simPass: true,
      logicPass: true,
      verifiedAt: '2026-07-27T00:00:00.000Z',
    })
    const multiTsl2591Status = validSimStatus({
      verifyHash: 'multi-tsl2591-hash-v1',
      compilePass: true,
      simPass: null,
      logicPass: false,
      staticIssues: [
        { code: 'i2c-address-conflict', severity: 'warning', message: 'shared bus address' },
      ],
      verifiedAt: '2026-07-27T00:00:01.000Z',
    })

    await Promise.all([
      writeSimStatus(ci.firestore(), 'pendulum', pendulumStatus),
      writeSimStatus(ci.firestore(), 'multi-tsl2591', multiTsl2591Status),
    ])

    const [pendulumSnap, multiSnap] = await Promise.all([
      ci.firestore().collection('simStatus').doc('pendulum').get(),
      ci.firestore().collection('simStatus').doc('multi-tsl2591').get(),
    ])

    expect(pendulumSnap.data()).toEqual(pendulumStatus)
    expect(multiSnap.data()).toEqual(multiTsl2591Status)

    // Isolation means exactly two docs — neither write fanned out into extra
    // documents, nor did one collapse into the other's id.
    const allStatuses = await ci.firestore().collection('simStatus').get()
    expect(allStatuses.docs.map((d) => d.id).sort()).toEqual(['multi-tsl2591', 'pendulum'])
  })

  it('rejects a status object missing a required field (verifiedAt) without writing', async () => {
    const ci = testEnv.authenticatedContext('ci-1', { ci: true })
    const invalidStatus = validSimStatus() as Partial<SimStatus>
    delete invalidStatus.verifiedAt

    await expect(
      writeSimStatus(ci.firestore(), 'pendulum', invalidStatus as SimStatus),
    ).rejects.toThrow()

    const snap = await ci.firestore().collection('simStatus').doc('pendulum').get()
    expect(snap.exists).toBe(false)
  })
})
