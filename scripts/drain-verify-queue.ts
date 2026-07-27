#!/usr/bin/env tsx
/**
 * Drains the live pre-publish verification queue as the dedicated Firebase
 * Auth CI user. This intentionally uses the client SDK rather than the Admin
 * SDK so firestore.rules and the `ci:true` custom claim remain enforced.
 */
import firebase from 'firebase/compat/app'
import 'firebase/compat/auth'
import 'firebase/compat/firestore'
import { actuators } from '../src/data/inventory-seed/actuators'
import { sensors } from '../src/data/inventory-seed/sensors'
import { drainVerifyQueue } from '../src/verification/drainVerifyQueue'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

async function main(): Promise<void> {
  const projectId = required('FIREBASE_PROJECT_ID')
  const app = firebase.initializeApp({
    apiKey: required('FIREBASE_API_KEY'),
    authDomain: process.env.FIREBASE_AUTH_DOMAIN?.trim() || `${projectId}.firebaseapp.com`,
    projectId,
  })

  const credential = await app
    .auth()
    .signInWithEmailAndPassword(
      required('FIREBASE_CI_EMAIL'),
      required('FIREBASE_CI_PASSWORD'),
    )
  const token = await credential.user?.getIdTokenResult(true)
  if (token?.claims.ci !== true) {
    throw new Error('Authenticated Firebase user does not have the required ci:true custom claim.')
  }

  await drainVerifyQueue(app.firestore(), { sensors, actuators })
  await app.auth().signOut()
  console.log('verifyRequests queue drained successfully.')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
