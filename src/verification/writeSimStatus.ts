import type firebase from 'firebase/compat/app'
import 'firebase/compat/firestore'
import { SimStatusSchema, type SimStatus } from '@/schema'

/**
 * Writes to the top-level `simStatus/{recipeId}` document (never nested
 * under `meta/`) using the caller-supplied Firestore instance, which must
 * already be authenticated as the CI identity per firestore.rules PL2.
 */
export async function writeSimStatus(
  firestore: firebase.firestore.Firestore,
  recipeId: string,
  status: SimStatus,
): Promise<void> {
  const validated = SimStatusSchema.parse(status)
  await firestore.collection('simStatus').doc(recipeId).set(validated)
}
