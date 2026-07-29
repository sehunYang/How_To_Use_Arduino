#!/usr/bin/env tsx
import { createHash } from 'node:crypto'
import firebase from 'firebase/compat/app'
import 'firebase/compat/app-check'
import 'firebase/compat/auth'
import 'firebase/compat/firestore'
import { AnonEventSchema, SearchFailureStatsSchema, StatsSchema, type AnonEvent } from '../src/schema'
import { applyEventBatch, sessionKey, type LearningSession } from '../src/telemetry/aggregateStats'
import { createCiAppCheckProvider } from '../src/firebase/ciAppCheckProvider'

const PAGE_SIZE = 200
const CURSOR_PATH = 'aggregationMeta/events'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function stateDocumentId(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

const projectId = required('FIREBASE_PROJECT_ID')
const app = firebase.initializeApp({
  projectId,
  apiKey: required('FIREBASE_API_KEY'),
  appId: required('FIREBASE_APP_ID'),
  authDomain: process.env.FIREBASE_AUTH_DOMAIN?.trim() || `${projectId}.firebaseapp.com`,
})
app.appCheck().activate(createCiAppCheckProvider({
  projectId,
  appId: required('FIREBASE_APP_ID'),
  apiKey: required('FIREBASE_API_KEY'),
  debugToken: required('FIREBASE_APPCHECK_DEBUG_TOKEN'),
}), false)

try {
  const credential = await app.auth().signInWithEmailAndPassword(
    required('FIREBASE_CI_EMAIL'),
    required('FIREBASE_CI_PASSWORD'),
  )
  const token = await credential.user?.getIdTokenResult(true)
  if (token?.claims.ci !== true) throw new Error('Firebase user must have the ci:true custom claim.')

  const db = app.firestore()
  const cursorRef = db.doc(CURSOR_PATH)
  let processed = 0

  while (true) {
    const cursorSnapshot = await cursorRef.get()
    const cursor = cursorSnapshot.data() as
      | { lastAt?: firebase.firestore.Timestamp; lastEventId?: string }
      | undefined

    let query = db.collection('events')
      .orderBy('at')
      .orderBy(firebase.firestore.FieldPath.documentId())
      .limit(PAGE_SIZE)
    if (cursor?.lastAt && cursor.lastEventId) {
      query = query.startAfter(cursor.lastAt, cursor.lastEventId)
    }

    const page = await query.get()
    if (page.empty) break

    const events: AnonEvent[] = page.docs.map((snapshot) => {
      const data = snapshot.data()
      const at = data.at?.toDate instanceof Function ? data.at.toDate().toISOString() : data.at
      return AnonEventSchema.parse({ ...data, at })
    })
    const searchFailureEvents = events.filter((event) => event.event === 'search_fail')
    const relevant = events.filter((event) => event.event !== 'search_fail')
    const recipeIds = [...new Set(relevant.map((event) => event.recipeId))]
    const sessionKeys = [...new Set(relevant.map((event) => sessionKey(event.recipeId, event.anonId)))]
    const statsRefs = recipeIds.map((id) => db.collection('stats').doc(id))
    const sessionRefs = sessionKeys.map((key) => db.collection('statsSessions').doc(stateDocumentId(key)))
    const searchStatsRef = db.doc('searchStats/summary')
    const stateSnapshots = await Promise.all([
      ...statsRefs.map((ref) => ref.get()),
      ...sessionRefs.map((ref) => ref.get()),
      searchStatsRef.get(),
    ])
    const statsSnapshots = stateSnapshots.slice(0, statsRefs.length)
    const sessionSnapshots = stateSnapshots.slice(statsRefs.length, statsRefs.length + sessionRefs.length)
    const searchStatsSnapshot = stateSnapshots.at(-1)!
    const existingStats = new Map(statsSnapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => [snapshot.id, StatsSchema.parse(snapshot.data())]))
    const existingSessions = new Map<string, LearningSession>()
    sessionSnapshots.forEach((snapshot, index) => {
      if (!snapshot.exists) return
      const data = snapshot.data() as LearningSession
      existingSessions.set(sessionKeys[index], {
        completed: data.completed === true,
        lastCheckedStep: typeof data.lastCheckedStep === 'number' ? data.lastCheckedStep : null,
      })
    })

    const next = applyEventBatch(events, existingStats, existingSessions)
    const batch = db.batch()
    for (const recipeId of recipeIds) {
      const value = next.stats.get(recipeId)
      if (value) batch.set(db.collection('stats').doc(recipeId), value)
    }
    sessionKeys.forEach((key) => {
      const value = next.sessions.get(key)
      if (value) batch.set(db.collection('statsSessions').doc(stateDocumentId(key)), value)
    })
    const lastDocument = page.docs.at(-1)!
    if (searchFailureEvents.length > 0) {
      const current = searchStatsSnapshot.exists
        ? SearchFailureStatsSchema.parse(searchStatsSnapshot.data())
        : SearchFailureStatsSchema.parse({})
      const tokens = { ...current.tokens }
      for (const event of searchFailureEvents) {
        for (const token of event.tokens ?? []) tokens[token] = (tokens[token] ?? 0) + 1
      }
      batch.set(searchStatsRef, {
        tokens,
        processedThrough: lastDocument.get('at').toDate().toISOString(),
      })
    }
    batch.set(cursorRef, {
      lastAt: lastDocument.get('at'),
      lastEventId: lastDocument.id,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    await batch.commit()
    processed += page.size
    if (page.size < PAGE_SIZE) break
  }

  console.log(`PASS: incrementally aggregated ${processed} new events.`)
} finally {
  await app.auth().signOut().catch(() => undefined)
  await app.firestore().terminate().catch(() => undefined)
  await app.delete()
}
