import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'

// Rule unit tests for US-009 / PL2 (8 scenarios) + the isAdmin()/isCI()
// auth-null guard (9th scenario). Runs only against the local Firebase
// emulator suite — see `test:rules` in package.json, which boots the
// emulator via `firebase emulators:exec` before invoking vitest. No network
// calls to a real Firebase project are made or possible (rules-unit-testing
// refuses to talk to production).

const PROJECT_ID = 'how-to-use-arduino-test'

let testEnv: RulesTestEnvironment

function validRecipe(overrides: Record<string, unknown> = {}) {
  return {
    title: 'LED 깜빡이기',
    status: 'published',
    ...overrides,
  }
}

function validEvent(overrides: Record<string, unknown> = {}) {
  return {
    anonId: 'anon-abc123',
    recipeId: 'recipe-1',
    event: 'start',
    at: new Date(),
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

describe('Firestore rules (PL2)', () => {
  it('(1) unauthenticated write to recipes is denied', async () => {
    const unauth = testEnv.unauthenticatedContext()
    await assertFails(
      unauth.firestore().collection('recipes').doc('r1').set(validRecipe()),
    )
  })

  it('(2) authenticated non-admin write to recipes is denied', async () => {
    const student = testEnv.authenticatedContext('student-1')
    await assertFails(
      student.firestore().collection('recipes').doc('r1').set(validRecipe()),
    )
  })

  it('(3) events read is denied for anonymous/non-admin/non-CI, allowed for admin and CI', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('events').doc('e1').set(validEvent())
    })

    const unauth = testEnv.unauthenticatedContext()
    await assertFails(unauth.firestore().collection('events').doc('e1').get())

    const student = testEnv.authenticatedContext('student-1')
    await assertFails(student.firestore().collection('events').doc('e1').get())

    const admin = testEnv.authenticatedContext('admin-1', { admin: true })
    await assertSucceeds(admin.firestore().collection('events').doc('e1').get())

    const ci = testEnv.authenticatedContext('ci-1', { ci: true })
    await assertSucceeds(ci.firestore().collection('events').doc('e1').get())
  })

  it('anonymous telemetry accepts normalized tokens and rejects raw or malformed payloads', async () => {
    const unauth = testEnv.unauthenticatedContext()
    const events = unauth.firestore().collection('events')
    await assertSucceeds(events.doc('valid-search').set(validEvent({
      recipeId: 'search',
      event: 'search_fail',
      tokens: ['진자가', 'robot', '123'],
    })))
    await assertFails(events.doc('raw-search').set(validEvent({
      recipeId: 'search',
      event: 'search_fail',
      tokens: ['진자가 어떻게 움직이는지 알려줘'],
    })))
    await assertFails(events.doc('non-string-token').set(validEvent({
      recipeId: 'search',
      event: 'search_fail',
      tokens: [123],
    })))
    await assertFails(events.doc('fractional-step').set(validEvent({
      event: 'step_check',
      step: 1.5,
    })))
    await assertFails(events.doc('tokens-on-start').set(validEvent({
      event: 'start',
      tokens: ['진자'],
    })))
    await assertFails(events.doc('missing-step').set(validEvent({
      event: 'step_check',
    })))
    await assertFails(events.doc('tokens-and-step').set(validEvent({
      event: 'search_fail',
      tokens: ['진자'],
      step: 1,
    })))
  })

  it('(5) CI-identity write to recipes is denied', async () => {
    const ci = testEnv.authenticatedContext('ci-1', { ci: true })
    await assertFails(
      ci.firestore().collection('recipes').doc('r1').set(validRecipe()),
    )
  })

  it('(6) non-CI authenticated client write to stats is denied', async () => {
    const student = testEnv.authenticatedContext('student-1')
    await assertFails(
      student
        .firestore()
        .collection('stats')
        .doc('recipe-1')
        .set({ started: 1, completed: 0, dropAtStep: {}, processedThrough: null }),
    )

    const admin = testEnv.authenticatedContext('admin-1', { admin: true })
    await assertFails(
      admin
        .firestore()
        .collection('stats')
        .doc('recipe-1')
        .set({ started: 1, completed: 0, dropAtStep: {}, processedThrough: null }),
    )
  })

  it('CI can read back the stats it writes, and anonymous clients still cannot', async () => {
    // aggregate-stats.ts adds each page onto the stored counters, so the cron
    // identity has to read stats/searchStats before it writes them. Without
    // this assertion the read side of those rules had no coverage at all and
    // Daily Verification failed for 27 days on permission-denied.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .collection('stats')
        .doc('recipe-1')
        .set({ started: 1, completed: 0, dropAtStep: {}, processedThrough: null })
      await ctx
        .firestore()
        .doc('searchStats/summary')
        .set({ failures: {}, processedThrough: null })
    })

    const ci = testEnv.authenticatedContext('ci-1', { ci: true })
    await assertSucceeds(ci.firestore().collection('stats').doc('recipe-1').get())
    await assertSucceeds(ci.firestore().doc('searchStats/summary').get())

    const admin = testEnv.authenticatedContext('admin-1', { admin: true })
    await assertSucceeds(admin.firestore().collection('stats').doc('recipe-1').get())
    await assertSucceeds(admin.firestore().doc('searchStats/summary').get())

    const student = testEnv.authenticatedContext('student-1')
    const unauth = testEnv.unauthenticatedContext()
    await assertFails(student.firestore().collection('stats').doc('recipe-1').get())
    await assertFails(student.firestore().doc('searchStats/summary').get())
    await assertFails(unauth.firestore().collection('stats').doc('recipe-1').get())
    await assertFails(unauth.firestore().doc('searchStats/summary').get())
  })

  it('incremental aggregation state and cursor are private to the CI identity', async () => {
    const student = testEnv.authenticatedContext('student-1')
    const admin = testEnv.authenticatedContext('admin-1', { admin: true })
    const ci = testEnv.authenticatedContext('ci-1', { ci: true })
    const session = { completed: false, lastCheckedStep: 2 }
    const cursor = { lastAt: new Date(), lastEventId: 'event-1' }

    await assertFails(student.firestore().collection('statsSessions').doc('s1').set(session))
    await assertFails(admin.firestore().collection('statsSessions').doc('s1').get())
    await assertSucceeds(ci.firestore().collection('statsSessions').doc('s1').set(session))
    await assertSucceeds(ci.firestore().collection('statsSessions').doc('s1').get())

    await assertFails(admin.firestore().collection('aggregationMeta').doc('events').set(cursor))
    await assertSucceeds(ci.firestore().collection('aggregationMeta').doc('events').set(cursor))
    await assertSucceeds(ci.firestore().collection('aggregationMeta').doc('events').get())
  })

  it('(7) an unfiltered recipes query is denied while a where(status==published) query succeeds', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .collection('recipes')
        .doc('pub-1')
        .set(validRecipe({ status: 'published' }))
      await ctx
        .firestore()
        .collection('recipes')
        .doc('draft-1')
        .set(validRecipe({ status: 'draft' }))
    })

    const unauth = testEnv.unauthenticatedContext()
    await assertFails(unauth.firestore().collection('recipes').get())
    await assertSucceeds(
      unauth
        .firestore()
        .collection('recipes')
        .where('status', '==', 'published')
        .get(),
    )
  })

  it('(8) CI identity can read events and can read+delete a verifyRequests doc it did not create', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .collection('verifyRequests')
        .doc('vr-1')
        .set({ requestedAt: new Date() })
      await ctx.firestore().collection('events').doc('e2').set(validEvent())
    })

    const ci = testEnv.authenticatedContext('ci-1', { ci: true })
    await assertSucceeds(ci.firestore().collection('events').doc('e2').get())
    await assertSucceeds(
      ci.firestore().collection('verifyRequests').doc('vr-1').get(),
    )
    await assertSucceeds(
      ci.firestore().collection('verifyRequests').doc('vr-1').delete(),
    )
  })

  it('(9) isAdmin()/isCI() evaluate cleanly (not a rules error) when request.auth is entirely absent', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .collection('recipes')
        .doc('draft-2')
        .set(validRecipe({ status: 'draft' }))
    })

    const unauth = testEnv.unauthenticatedContext()
    // This read forces evaluation of `isAdmin() || isCI()` (status != 'published'),
    // which dereferences request.auth.token. Without the `request.auth != null`
    // guard this throws an internal rules-evaluation error instead of cleanly
    // resolving to a permission-denied rejection. assertFails() only accepts
    // "permission denied" — an internal error would make this test itself fail.
    await assertFails(
      unauth.firestore().collection('recipes').doc('draft-2').get(),
    )
  })

  it('recipe versions are admin-only and immutable', async () => {
    const student = testEnv.authenticatedContext('student-1')
    const admin = testEnv.authenticatedContext('admin-1', { admin: true })
    const studentVersion = student.firestore().collection('recipes').doc('r1').collection('versions').doc('v1')
    const adminVersion = admin.firestore().collection('recipes').doc('r1').collection('versions').doc('v1')
    const data = { recipe: validRecipe(), savedAt: '2026-01-01T00:00:00.000Z' }

    await assertFails(studentVersion.set(data))
    await assertSucceeds(adminVersion.set(data))
    await assertSucceeds(adminVersion.get())
    await assertFails(adminVersion.update({ savedAt: '2026-01-02T00:00:00.000Z' }))
    await assertFails(adminVersion.delete())
  })

  it('sensor rationales are public-readable but admin-write-only', async () => {
    const unauth = testEnv.unauthenticatedContext()
    const student = testEnv.authenticatedContext('student-1')
    const admin = testEnv.authenticatedContext('admin-1', { admin: true })
    const rationale = { sensorId: 'mpu6050', subject: null, whyText: 'Measures motion.' }
    const id = 'mpu6050__general'

    await assertFails(student.firestore().collection('sensorRationales').doc(id).set(rationale))
    await assertSucceeds(admin.firestore().collection('sensorRationales').doc(id).set(rationale))
    await assertSucceeds(unauth.firestore().collection('sensorRationales').doc(id).get())
  })
})

describe('Storage rules (PL2 ④)', () => {
  it('(4) non-admin authenticated Storage upload to wiring/ is denied', async () => {
    const student = testEnv.authenticatedContext('student-1')
    const bytes = new Uint8Array([1, 2, 3, 4])
    // .put() returns a (compat-style) UploadTask, which is thenable but not
    // structurally typed as Promise<T>; Promise.resolve() adopts it so
    // assertFails() (which requires a real Promise) type-checks cleanly.
    await assertFails(
      Promise.resolve(
        student.storage().ref('wiring/photo.png').put(bytes, { contentType: 'image/png' }),
      ),
    )
  })

  it('admin image upload is allowed at a recipe-scoped path while invalid payloads are denied', async () => {
    const admin = testEnv.authenticatedContext('admin-1', { admin: true })
    const bytes = new Uint8Array([1, 2, 3, 4])

    await assertSucceeds(Promise.resolve(
      admin.storage().ref('wiring/recipe-1/photo.png').put(bytes, { contentType: 'image/png' }),
    ))
    await assertFails(Promise.resolve(
      admin.storage().ref('wiring/recipe-1/readme.txt').put(bytes, { contentType: 'text/plain' }),
    ))
  })
})
