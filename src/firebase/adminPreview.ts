import { ensureAppCheck, getClientApp } from './clientApp'
import { RecipeSchema } from '@/schema'

export function hasAdminClaim(claims: Record<string, unknown>): boolean {
  return claims.admin === true
}

export async function authorizeAdminPreview(): Promise<boolean> {
  const app = await getClientApp()
  if (!app || !(await ensureAppCheck(app))) return false
  const { getAuth } = await import('firebase/auth')
  const auth = getAuth(app)
  await auth.authStateReady()
  if (!auth.currentUser) return false
  return hasAdminClaim((await auth.currentUser.getIdTokenResult()).claims)
}

export async function loadAdminPreviewRecipe(recipeId: string) {
  const app = await getClientApp()
  if (!app || !(await ensureAppCheck(app))) return null
  const { doc, getDoc, getFirestore } = await import('firebase/firestore')
  const snapshot = await getDoc(doc(getFirestore(app), 'recipes', recipeId))
  if (!snapshot.exists()) return null
  const parsed = RecipeSchema.safeParse(snapshot.data())
  return parsed.success ? parsed.data : null
}
