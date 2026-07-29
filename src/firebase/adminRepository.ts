import type { User } from 'firebase/auth'
import type { Subject } from '@/schema/common'
import {
  RecipeSchema,
  SearchFailureStatsSchema,
  SensorRationaleSchema,
  SensorSchema,
  SimStatusSchema,
  StatsSchema,
  type Recipe,
  type SearchIndexEntry,
  type Sensor,
  type SensorRationale,
  type SimStatus,
  type Stats,
} from '@/schema'
import { buildIndexEntry } from '@/search/buildIndexEntry'
import type { Inventory } from '@/validation/staticCheck'
import {
  recipeVerifyHash,
  validateDraft,
  validatePublish,
  type AuthoringValidation,
} from '@/admin/authoring'
import { ensureAppCheck, getClientApp } from './clientApp'

export class AdminAuthorizationError extends Error {
  constructor(message = '관리자 권한이 있는 계정으로 로그인해야 합니다.') {
    super(message)
    this.name = 'AdminAuthorizationError'
  }
}

export class AuthoringValidationError extends Error {
  constructor(readonly validation: AuthoringValidation) {
    super('레시피가 저작 검증을 통과하지 못했습니다.')
    this.name = 'AuthoringValidationError'
  }
}

export interface AdminSession {
  user: User
  claims: Record<string, unknown>
}

export interface RecipeVersion {
  id: string
  savedAt: string
  recipe: Recipe
}

export interface DashboardStat {
  recipeId: string
  stats: Stats
}

const DASHBOARD_READ_LIMIT = 49

function withoutUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

async function requireApp() {
  const app = await getClientApp()
  if (!app) throw new Error('Firebase가 설정되지 않았습니다.')
  return app
}

async function requireCheckedApp() {
  const app = await requireApp()
  if (!(await ensureAppCheck(app))) throw new Error('Firebase App Check가 설정되지 않았습니다.')
  return app
}

async function sessionFor(user: User | null): Promise<AdminSession | null> {
  if (!user) return null
  const token = await user.getIdTokenResult()
  if (token.claims.admin !== true) return null
  return { user, claims: token.claims }
}

export async function signInAdmin(email: string, password: string): Promise<AdminSession> {
  const app = await requireApp()
  const { getAuth, signInWithEmailAndPassword, signOut } = await import('firebase/auth')
  const auth = getAuth(app)
  const credential = await signInWithEmailAndPassword(auth, email, password)
  const session = await sessionFor(credential.user)
  if (!session) {
    await signOut(auth)
    throw new AdminAuthorizationError()
  }
  return session
}

export async function getAdminSession(forceRefresh = false): Promise<AdminSession | null> {
  const app = await requireApp()
  const { getAuth } = await import('firebase/auth')
  const auth = getAuth(app)
  await auth.authStateReady()
  if (forceRefresh && auth.currentUser) await auth.currentUser.getIdToken(true)
  return sessionFor(auth.currentUser)
}

export async function signOutAdmin(): Promise<void> {
  const app = await requireApp()
  const { getAuth, signOut } = await import('firebase/auth')
  await signOut(getAuth(app))
}

async function firestore() {
  const app = await requireCheckedApp()
  const { getFirestore } = await import('firebase/firestore')
  return getFirestore(app)
}

function versionId(now: Date): string {
  return `${now.toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}`
}

function replaceIndexEntry(
  entries: SearchIndexEntry[],
  next: SearchIndexEntry | null,
  recipeId: string,
): SearchIndexEntry[] {
  const remaining = entries.filter((entry) => entry.id !== recipeId)
  if (next) remaining.push(next)
  return remaining.sort((a, b) => a.title.localeCompare(b.title, 'ko'))
}

async function persistRecipe(recipe: Recipe, now: Date): Promise<void> {
  const db = await firestore()
  const {
    doc,
    runTransaction,
  } = await import('firebase/firestore')
  const recipeRef = doc(db, 'recipes', recipe.id)
  const indexRef = doc(db, 'meta', 'index')
  const historyRef = doc(db, 'recipes', recipe.id, 'versions', versionId(now))
  const indexEntry = buildIndexEntry(recipe)

  await runTransaction(db, async (transaction) => {
    const indexSnapshot = await transaction.get(indexRef)
    const currentEntries = indexSnapshot.exists() && Array.isArray(indexSnapshot.data().entries)
      ? indexSnapshot.data().entries as SearchIndexEntry[]
      : []
    const entries = replaceIndexEntry(currentEntries, indexEntry, recipe.id)
    const savedAt = now.toISOString()

    transaction.set(recipeRef, withoutUndefined(recipe))
    transaction.set(historyRef, { recipe: withoutUndefined(recipe), savedAt })
    transaction.set(indexRef, { entries, updatedAt: savedAt }, { merge: true })
  })
}

export async function saveRecipeDraft(
  input: unknown,
  inventory: Inventory,
  inventoryVersion: string,
  now = new Date(),
): Promise<AuthoringValidation> {
  const candidate = input && typeof input === 'object'
    ? { ...input, status: 'draft', updatedAt: now.toISOString() }
    : input
  const validation = validateDraft(candidate, inventory, inventoryVersion)
  if (!validation.canSave || !validation.recipe) throw new AuthoringValidationError(validation)
  await persistRecipe(validation.recipe, now)
  return validation
}

export async function publishRecipe(
  input: unknown,
  inventory: Inventory,
  inventoryVersion: string,
  now = new Date(),
): Promise<AuthoringValidation> {
  const db = await firestore()
  const { doc, getDoc } = await import('firebase/firestore')
  const candidate = input && typeof input === 'object'
    ? { ...input, status: 'published', updatedAt: now.toISOString() }
    : input
  const recipeId = candidate && typeof candidate === 'object' && 'id' in candidate
    ? String(candidate.id)
    : ''
  const statusSnapshot = recipeId
    ? await getDoc(doc(db, 'simStatus', recipeId))
    : null
  const parsedStatus = statusSnapshot?.exists()
    ? SimStatusSchema.safeParse(statusSnapshot.data())
    : null
  const simStatus: SimStatus | null = parsedStatus?.success ? parsedStatus.data : null
  const validation = validatePublish(candidate, inventory, inventoryVersion, simStatus)
  if (!validation.canPublish || !validation.recipe) throw new AuthoringValidationError(validation)
  await persistRecipe(validation.recipe, now)
  return validation
}

export async function checkRecipePublish(
  input: unknown,
  inventory: Inventory,
  inventoryVersion: string,
): Promise<AuthoringValidation> {
  const db = await firestore()
  const { doc, getDoc } = await import('firebase/firestore')
  const candidate = input && typeof input === 'object'
    ? { ...input, status: 'published' }
    : input
  const recipeId = candidate && typeof candidate === 'object' && 'id' in candidate
    ? String(candidate.id)
    : ''
  const snapshot = recipeId ? await getDoc(doc(db, 'simStatus', recipeId)) : null
  const parsed = snapshot?.exists() ? SimStatusSchema.safeParse(snapshot.data()) : null
  return validatePublish(
    candidate,
    inventory,
    inventoryVersion,
    parsed?.success ? parsed.data : null,
  )
}

export async function requestRecipeVerification(
  recipe: Recipe,
  inventoryVersion: string,
): Promise<string> {
  const db = await firestore()
  const { doc, serverTimestamp, setDoc } = await import('firebase/firestore')
  const verifyHash = recipeVerifyHash(recipe, inventoryVersion)
  await setDoc(doc(db, 'verifyRequests', recipe.id), {
    recipeId: recipe.id,
    verifyHash,
    requestedAt: serverTimestamp(),
  })
  return verifyHash
}

export async function loadAdminRecipe(recipeId: string): Promise<Recipe | null> {
  const db = await firestore()
  const { doc, getDoc } = await import('firebase/firestore')
  const snapshot = await getDoc(doc(db, 'recipes', recipeId))
  if (!snapshot.exists()) return null
  const parsed = RecipeSchema.safeParse({ ...snapshot.data(), id: snapshot.id })
  return parsed.success ? parsed.data : null
}

export async function listAdminRecipes(count = 100): Promise<Recipe[]> {
  const db = await firestore()
  const { collection, getDocs, limit, query } = await import('firebase/firestore')
  const snapshot = await getDocs(query(
    collection(db, 'recipes'),
    limit(Math.max(1, Math.min(count, 100))),
  ))
  return snapshot.docs.flatMap((entry) => {
    const parsed = RecipeSchema.safeParse({ ...entry.data(), id: entry.id })
    return parsed.success ? [parsed.data] : []
  })
}

export async function listRecipeVersions(recipeId: string, count = 20): Promise<RecipeVersion[]> {
  const db = await firestore()
  const { collection, getDocs, limit, orderBy, query } = await import('firebase/firestore')
  const snapshot = await getDocs(query(
    collection(db, 'recipes', recipeId, 'versions'),
    orderBy('savedAt', 'desc'),
    limit(Math.max(1, Math.min(count, 50))),
  ))
  return snapshot.docs.flatMap((entry) => {
    const data = entry.data()
    const parsed = RecipeSchema.safeParse(data.recipe)
    return parsed.success && typeof data.savedAt === 'string'
      ? [{ id: entry.id, savedAt: data.savedAt, recipe: parsed.data }]
      : []
  })
}

export async function restoreRecipeVersion(
  recipeId: string,
  versionIdToRestore: string,
  inventory: Inventory,
  inventoryVersion: string,
  now = new Date(),
): Promise<AuthoringValidation> {
  const db = await firestore()
  const { doc, getDoc } = await import('firebase/firestore')
  const snapshot = await getDoc(doc(db, 'recipes', recipeId, 'versions', versionIdToRestore))
  if (!snapshot.exists()) throw new Error('레시피 버전을 찾을 수 없습니다.')
  const recipe = RecipeSchema.parse(snapshot.data().recipe)
  return saveRecipeDraft({ ...recipe, id: recipeId }, inventory, inventoryVersion, now)
}

export async function rebuildSearchIndex(now = new Date()): Promise<void> {
  const recipes = await listAdminRecipes(100)
  const entries = recipes.flatMap((recipe) => {
    const entry = buildIndexEntry(recipe)
    return entry ? [entry] : []
  })
  const db = await firestore()
  const { doc, setDoc } = await import('firebase/firestore')
  await setDoc(doc(db, 'meta', 'index'), {
    entries: entries.sort((a, b) => a.title.localeCompare(b.title, 'ko')),
    updatedAt: now.toISOString(),
  })
}

export async function listSensors(): Promise<Sensor[]> {
  const db = await firestore()
  const { collection, getDocs } = await import('firebase/firestore')
  const snapshot = await getDocs(collection(db, 'sensors'))
  return snapshot.docs.map((entry) => SensorSchema.parse({ ...entry.data(), id: entry.id }))
}

export async function saveSensor(sensor: Sensor): Promise<void> {
  const validated = SensorSchema.parse(sensor)
  const db = await firestore()
  const { doc, setDoc } = await import('firebase/firestore')
  await setDoc(doc(db, 'sensors', validated.id), withoutUndefined(validated))
}

export async function deleteSensor(sensorId: string): Promise<void> {
  const db = await firestore()
  const { deleteDoc, doc } = await import('firebase/firestore')
  await deleteDoc(doc(db, 'sensors', sensorId))
}

export function sensorRationaleId(sensorId: string, subject: Subject | null): string {
  return `${encodeURIComponent(sensorId)}__${encodeURIComponent(subject ?? 'general')}`
}

export async function listSensorRationales(): Promise<SensorRationale[]> {
  const db = await firestore()
  const { collection, getDocs } = await import('firebase/firestore')
  const snapshot = await getDocs(collection(db, 'sensorRationales'))
  return snapshot.docs.map((entry) => SensorRationaleSchema.parse(entry.data()))
}

export async function saveSensorRationale(rationale: SensorRationale): Promise<void> {
  const validated = SensorRationaleSchema.parse(rationale)
  const db = await firestore()
  const { doc, setDoc } = await import('firebase/firestore')
  await setDoc(
    doc(db, 'sensorRationales', sensorRationaleId(validated.sensorId, validated.subject)),
    validated,
  )
}

export async function deleteSensorRationale(sensorId: string, subject: Subject | null): Promise<void> {
  const db = await firestore()
  const { deleteDoc, doc } = await import('firebase/firestore')
  await deleteDoc(doc(db, 'sensorRationales', sensorRationaleId(sensorId, subject)))
}

/** A dashboard load is hard-capped at 50 Firestore document reads (PL9). */
export async function loadDashboardStats(): Promise<DashboardStat[]> {
  const db = await firestore()
  const { collection, documentId, getDocs, limit, orderBy, query } = await import('firebase/firestore')
  const snapshot = await getDocs(query(
    collection(db, 'stats'),
    orderBy(documentId()),
    limit(DASHBOARD_READ_LIMIT),
  ))
  return snapshot.docs.flatMap((entry) => {
    const parsed = StatsSchema.safeParse(entry.data())
    return parsed.success ? [{ recipeId: entry.id, stats: parsed.data }] : []
  })
}

export async function loadFailedSearchTokens(): Promise<Array<{ token: string; count: number }>> {
  const db = await firestore()
  const { doc, getDoc } = await import('firebase/firestore')
  const snapshot = await getDoc(doc(db, 'searchStats', 'summary'))
  if (!snapshot.exists()) return []
  const parsed = SearchFailureStatsSchema.safeParse(snapshot.data())
  if (!parsed.success) return []
  return Object.entries(parsed.data.tokens)
    .map(([token, count]) => ({ token, count }))
    .sort((a, b) => b.count - a.count || a.token.localeCompare(b.token, 'ko'))
    .slice(0, 50)
}

export async function uploadWiringImage(
  recipeId: string,
  file: Blob,
  fileName: string,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 업로드할 수 있습니다.')
  if (file.size >= 5 * 1024 * 1024) throw new Error('이미지는 5MiB보다 작아야 합니다.')
  const app = await requireCheckedApp()
  const { getDownloadURL, getStorage, ref, uploadBytesResumable } = await import('firebase/storage')
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `wiring/${encodeURIComponent(recipeId)}/${crypto.randomUUID()}-${safeName}`
  const task = uploadBytesResumable(ref(getStorage(app), path), file, { contentType: file.type })
  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => onProgress?.(snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0),
      reject,
      resolve,
    )
  })
  return getDownloadURL(task.snapshot.ref)
}
