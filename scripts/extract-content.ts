#!/usr/bin/env tsx
/**
 * CI script for US-202 (검증 원장 2.1): pulls every recipe visible to the CI
 * identity from the local Firestore emulator, runs it through the pure
 * extractContent() pipeline, and writes sketches/{id}.ino + diagram/{id}.json
 * to disk. Uses the Admin SDK against FIRESTORE_EMULATOR_HOST — the Admin
 * SDK bypasses firestore.rules entirely (by design, see docs/firebase-setup.md
 * section 4.3), which is what lets this script see draft recipes too; it is
 * never given production credentials.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { Recipe } from '@/schema'
import { sensors } from '../src/data/inventory-seed/sensors'
import { extractContent } from '../src/verification/extractContent'

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'how-to-use-arduino-test'
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'

initializeApp({ projectId: PROJECT_ID })
const db = getFirestore()

async function main() {
  const snapshot = await db.collection('recipes').get()

  mkdirSync('sketches', { recursive: true })
  mkdirSync('diagram', { recursive: true })

  for (const doc of snapshot.docs) {
    const recipe = doc.data() as Recipe
    const { sketchFilename, sketchContent, diagram } = extractContent(recipe, sensors)

    writeFileSync(`sketches/${sketchFilename}`, sketchContent, 'utf-8')
    writeFileSync(`diagram/${recipe.id}.json`, JSON.stringify(diagram, null, 2), 'utf-8')
    console.log(`추출 완료: ${recipe.id}`)
  }

  console.log(`총 ${snapshot.docs.length}개 레시피 추출됨`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
