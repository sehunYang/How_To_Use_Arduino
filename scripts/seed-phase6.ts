#!/usr/bin/env tsx
import firebase from 'firebase/compat/app'
import 'firebase/compat/app-check'
import 'firebase/compat/auth'
import 'firebase/compat/firestore'
import { phase6Recipes } from '../src/data/phase6'
import { createCiAppCheckProvider } from '../src/firebase/ciAppCheckProvider'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
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
  }, 'phase6-seed')
  app.appCheck().activate(createCiAppCheckProvider({
    projectId,
    appId,
    apiKey,
    debugToken: required('FIREBASE_APPCHECK_DEBUG_TOKEN'),
  }), false)

  try {
    const credential = await app.auth().signInWithEmailAndPassword(
      required('FIREBASE_ADMIN_EMAIL'),
      required('FIREBASE_ADMIN_PASSWORD'),
    )
    const token = await credential.user?.getIdTokenResult(true)
    if (token?.claims.admin !== true) {
      throw new Error('Authenticated Firebase user does not have admin:true.')
    }

    const savedAt = new Date().toISOString()
    const db = app.firestore()
    for (let offset = 0; offset < phase6Recipes.length; offset += 400) {
      const batch = db.batch()
      for (const recipe of phase6Recipes.slice(offset, offset + 400)) {
        const draft = { ...recipe, status: 'draft' as const, updatedAt: savedAt }
        const ref = db.collection('recipes').doc(recipe.id)
        batch.set(ref, draft)
        batch.set(ref.collection('versions').doc(`phase6-seed-${savedAt.replace(/[:.]/g, '-')}`), {
          recipe: draft,
          savedAt,
        })
      }
      await batch.commit()
    }
    console.log(`Seeded ${phase6Recipes.length} Phase 6 draft recipes.`)
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
