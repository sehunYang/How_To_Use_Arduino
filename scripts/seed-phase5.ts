#!/usr/bin/env tsx
/**
 * Seeds the reviewed source-controlled Phase 5 drafts through the same
 * Firestore security boundary as the browser administrator. It never
 * publishes recipes or updates meta/index; publication remains a deliberate
 * per-recipe action after device/comment review and verification.
 */
import firebase from 'firebase/compat/app'
import 'firebase/compat/app-check'
import 'firebase/compat/auth'
import 'firebase/compat/firestore'
import { phase5Rationales, phase5Recipes } from '../src/data/phase5'
import { createCiAppCheckProvider } from '../src/firebase/ciAppCheckProvider'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function rationaleId(sensorId: string, subject: string | null): string {
  return `${encodeURIComponent(sensorId)}__${encodeURIComponent(subject ?? 'general')}`
}

async function main(): Promise<void> {
  const projectId = required('FIREBASE_PROJECT_ID')
  const apiKey = required('FIREBASE_API_KEY')
  const appId = required('FIREBASE_APP_ID')
  const app = firebase.initializeApp({
    apiKey,
    appId,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN?.trim() || `${projectId}.firebaseapp.com`,
    projectId,
  })
  app.appCheck().activate(
    createCiAppCheckProvider({
      projectId,
      appId,
      apiKey,
      debugToken: required('FIREBASE_APPCHECK_DEBUG_TOKEN'),
    }),
    false,
  )

  try {
    const credential = await app.auth().signInWithEmailAndPassword(
      required('FIREBASE_ADMIN_EMAIL'),
      required('FIREBASE_ADMIN_PASSWORD'),
    )
    const token = await credential.user?.getIdTokenResult(true)
    if (token?.claims.admin !== true) {
      throw new Error('Authenticated Firebase user does not have the required admin:true custom claim.')
    }

    const db = app.firestore()
    const batch = db.batch()
    const savedAt = new Date().toISOString()
    for (const recipe of phase5Recipes) {
      const draft = { ...recipe, status: 'draft' as const, updatedAt: savedAt }
      batch.set(db.collection('recipes').doc(recipe.id), draft)
      batch.set(
        db.collection('recipes').doc(recipe.id).collection('versions').doc(`phase5-seed-${savedAt.replace(/[:.]/g, '-')}`),
        { recipe: draft, savedAt },
      )
    }
    for (const rationale of phase5Rationales) {
      batch.set(
        db.collection('sensorRationales').doc(rationaleId(rationale.sensorId, rationale.subject)),
        rationale,
      )
    }
    await batch.commit()
    console.log(`Seeded ${phase5Recipes.length} draft recipes and ${phase5Rationales.length} rationales.`)
  } finally {
    await app.auth().signOut().catch(() => undefined)
    await app.firestore().terminate().catch(() => undefined)
    await app.delete()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
