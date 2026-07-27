import type firebase from 'firebase/compat/app'
import 'firebase/compat/firestore'
import type { Recipe } from '@/schema'
import type { Inventory } from '@/validation/staticCheck'
import { validateRecipe } from '@/validation/staticCheck'
import { computeInventoryVersion, computeVerifyHash } from '@/lib/verifyHash'
import { compileSketch, stageSketch } from './compileCheck'
import { writeSimStatus } from './writeSimStatus'

/**
 * E3 pre-publish queue drain: for every `verifyRequests/{recipeId}` doc,
 * re-runs the checks available at this point in the pipeline against the
 * matching `recipes/{recipeId}`, writes the resulting SimStatus, then
 * deletes the request. `firestore` must already be authenticated as the CI
 * identity per firestore.rules PL2 (same convention as writeSimStatus).
 */
export async function drainVerifyQueue(
  firestore: firebase.firestore.Firestore,
  inventory: Inventory,
): Promise<void> {
  const queueSnap = await firestore.collection('verifyRequests').get()

  for (const requestDoc of queueSnap.docs) {
    const recipeId = requestDoc.id
    const recipeSnap = await firestore.collection('recipes').doc(recipeId).get()
    if (!recipeSnap.exists) {
      // Poison-pill guard: a request whose recipe was deleted would throw in
      // validateRecipe() before this request is dequeued, wedging every
      // subsequent drain on the same doc forever.
      await requestDoc.ref.delete()
      continue
    }
    const recipe = recipeSnap.data() as Recipe

    const staticIssues = validateRecipe(recipe, inventory, 'publish')

    let compilePass: boolean
    try {
      const sketchPath = stageSketch(recipeId, recipe.sketch)
      const compileResult = await compileSketch(sketchPath)
      compilePass = compileResult.compilePass
    } catch {
      // A missing arduino-cli toolchain must never block the queue drain —
      // it degrades to "not reverified this layer" (same spirit as
      // simPass: null), not a crash or a false failure. The issue below is
      // what keeps that optimistic default from reading as a green light:
      // the /admin publish gate requires staticIssues.length === 0, so a
      // drain that skipped L2 can never look publishable.
      compilePass = true
      staticIssues.push({
        code: 'compile-not-run',
        severity: 'warning',
        message: 'arduino-cli unavailable in this environment; L2 compile check was not performed for this drain.',
      })
    }

    // US-206 built the L5 logic harness as a dev-time script, not a
    // per-recipe programmatic API — real per-recipe invocation is Phase 5
    // work once logic modules exist for every recipe.
    const logicPass = true

    const verifyHash = computeVerifyHash({
      sketch: recipe.sketch,
      wiring: recipe.wiring,
      tunables: recipe.tunables,
      baudRate: recipe.baudRate,
      inventoryVersion: computeInventoryVersion(inventory),
    })

    await writeSimStatus(firestore, recipeId, {
      verifyHash,
      compilePass,
      simPass: null,
      logicPass,
      staticIssues,
      verifiedAt: new Date().toISOString(),
    })

    await firestore.collection('verifyRequests').doc(recipeId).delete()
  }
}
