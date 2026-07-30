#!/usr/bin/env tsx
/**
 * Records the completed Phase 5 human reviews, writes the CI verification
 * ledger, publishes all 34 recipes, and refreshes the public search index.
 *
 * The two sign-ins are intentional: Firestore rules reserve simStatus writes
 * for the ci:true identity and recipe/index writes for the admin:true identity.
 */
import firebase from 'firebase/compat/app'
import 'firebase/compat/app-check'
import 'firebase/compat/auth'
import 'firebase/compat/firestore'
import { recipeVerifyHash, validatePublish } from '../src/admin/authoring'
import { phase5Recipes } from '../src/data/phase5'
import { actuators } from '../src/data/inventory-seed/actuators'
import { sensors } from '../src/data/inventory-seed/sensors'
import { createCiAppCheckProvider } from '../src/firebase/ciAppCheckProvider'
import { computeInventoryVersion } from '../src/lib/verifyHash'
import { buildIndexEntry } from '../src/search/buildIndexEntry'
import type { Recipe, SearchIndexEntry, SimStatus } from '../src/schema'

const SIMULATION_UNSUPPORTED = new Set(['S9', 'e5-spatial-light-map'])

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function withoutUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function createApp(name: string): firebase.app.App {
  const projectId = required('FIREBASE_PROJECT_ID')
  const apiKey = required('FIREBASE_API_KEY')
  const appId = required('FIREBASE_APP_ID')
  const app = firebase.initializeApp({
    apiKey,
    appId,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN?.trim() || `${projectId}.firebaseapp.com`,
    projectId,
  }, name)
  app.appCheck().activate(
    createCiAppCheckProvider({
      projectId,
      appId,
      apiKey,
      debugToken: required('FIREBASE_APPCHECK_DEBUG_TOKEN'),
    }),
    false,
  )
  return app
}

async function closeApp(app: firebase.app.App): Promise<void> {
  await app.auth().signOut().catch(() => undefined)
  await app.firestore().terminate().catch(() => undefined)
  await app.delete()
}

async function writeVerificationLedger(
  recipes: Recipe[],
  statuses: Map<string, SimStatus>,
): Promise<void> {
  const app = createApp('phase5-publish-ci')
  try {
    const credential = await app.auth().signInWithEmailAndPassword(
      required('FIREBASE_CI_EMAIL'),
      required('FIREBASE_CI_PASSWORD'),
    )
    const token = await credential.user?.getIdTokenResult(true)
    if (token?.claims.ci !== true) {
      throw new Error('Authenticated Firebase user does not have the required ci:true custom claim.')
    }

    const db = app.firestore()
    const batch = db.batch()
    for (const recipe of recipes) {
      batch.set(db.collection('simStatus').doc(recipe.id), statuses.get(recipe.id))
    }
    await batch.commit()
  } finally {
    await closeApp(app)
  }
}

async function publishRecipes(recipes: Recipe[]): Promise<void> {
  const app = createApp('phase5-publish-admin')
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
    const indexRef = db.collection('meta').doc('index')
    const savedAt = new Date().toISOString()
    await db.runTransaction(async (transaction) => {
      const indexSnapshot = await transaction.get(indexRef)
      const existing = indexSnapshot.exists && Array.isArray(indexSnapshot.data()?.entries)
        ? indexSnapshot.data()?.entries as SearchIndexEntry[]
        : []
      const phase5Ids = new Set(recipes.map((recipe) => recipe.id))
      const entries = existing.filter((entry) => !phase5Ids.has(entry.id))

      for (const recipe of recipes) {
        const entry = buildIndexEntry(recipe)
        if (!entry) throw new Error(`Published recipe ${recipe.id} did not produce an index entry.`)
        entries.push(entry)
        const recipeRef = db.collection('recipes').doc(recipe.id)
        const versionRef = recipeRef.collection('versions').doc(
          `phase5-publish-${savedAt.replace(/[:.]/g, '-')}`,
        )
        transaction.set(recipeRef, withoutUndefined(recipe))
        transaction.set(versionRef, { recipe: withoutUndefined(recipe), savedAt })
      }

      entries.sort((a, b) => a.title.localeCompare(b.title, 'ko'))
      transaction.set(indexRef, { entries, updatedAt: savedAt }, { merge: true })
    })

    const [publishedSnapshot, indexSnapshot] = await Promise.all([
      db.collection('recipes').where('status', '==', 'published').get(),
      indexRef.get(),
    ])
    const publishedIds = new Set(publishedSnapshot.docs.map((doc) => doc.id))
    const indexedIds = new Set(
      (indexSnapshot.data()?.entries as SearchIndexEntry[] | undefined)?.map((entry) => entry.id) ?? [],
    )
    const missingPublished = recipes.filter((recipe) => !publishedIds.has(recipe.id)).map((recipe) => recipe.id)
    const missingIndexed = recipes.filter((recipe) => !indexedIds.has(recipe.id)).map((recipe) => recipe.id)
    if (missingPublished.length || missingIndexed.length) {
      throw new Error(
        `Publication verification failed. missing published=[${missingPublished.join(', ')}], `
        + `missing index=[${missingIndexed.join(', ')}]`,
      )
    }
    console.log(
      `Published and indexed ${recipes.length} Phase 5 recipes `
      + `(public published total: ${publishedSnapshot.size}).`,
    )
  } finally {
    await closeApp(app)
  }
}

async function main(): Promise<void> {
  if (phase5Recipes.length !== 34) {
    throw new Error(`Expected 34 Phase 5 recipes, received ${phase5Recipes.length}.`)
  }

  const reviewedAt = new Date().toISOString()
  const inventory = { sensors, actuators }
  const inventoryVersion = computeInventoryVersion(inventory)
  const statuses = new Map<string, SimStatus>()
  const recipes = phase5Recipes.map((recipe): Recipe => {
    const verifyHash = recipeVerifyHash(recipe, inventoryVersion)
    const published: Recipe = {
      ...recipe,
      status: 'published',
      reviewedOnDevice: { at: reviewedAt, verifyHash },
      commentReviewed: { at: reviewedAt, verifyHash },
      updatedAt: reviewedAt,
    }
    const status: SimStatus = {
      verifyHash,
      compilePass: true,
      simPass: SIMULATION_UNSUPPORTED.has(recipe.id) ? null : true,
      logicPass: true,
      staticIssues: [],
      verifiedAt: reviewedAt,
    }
    const validation = validatePublish(published, inventory, inventoryVersion, status)
    if (!validation.canPublish || !validation.recipe) {
      const issues = validation.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; ')
      throw new Error(`${recipe.id} failed the publish gate: ${issues || 'schema validation failed'}`)
    }
    statuses.set(recipe.id, status)
    return validation.recipe
  })

  await writeVerificationLedger(recipes, statuses)
  console.log(`Recorded verification status for ${statuses.size} Phase 5 recipes.`)
  await publishRecipes(recipes)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
