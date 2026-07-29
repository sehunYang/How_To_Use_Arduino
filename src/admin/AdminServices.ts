import type { Actuator, Recipe, Sensor, SensorRationale, StaticIssue, Stats } from '@/schema'

export type AdminAuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'access-denied'; email?: string }
  | { status: 'admin'; email: string }

export type DashboardStats = {
  rows: Array<{
    recipeId: string
    title?: string
    stats: Stats
  }>
  failedTokens: Array<{ token: string; count: number }>
}

/** Full recipe shape prevents authoring round-trips from dropping schema fields. */
export type AdminRecipeDraft = Omit<Recipe, 'subject' | 'difficulty'> & {
  subject: Recipe['subject'] | ''
  difficulty: Recipe['difficulty'] | ''
}

export type ImageUploadResult = {
  url: string
  width: number
  height: number
}

export type PublishReadiness = {
  canPublish: boolean
  issues: StaticIssue[]
}

export type AdminRecipeVersion = {
  id: string
  savedAt: string
  recipe: AdminRecipeDraft
}

export type AdminServiceError = Error & {
  /** Dot paths match the editor model, for example `title` or `wiring.0.from`. */
  fieldErrors?: Record<string, string>
}

export function readFieldErrors(reason: unknown): Record<string, string> {
  if (!reason || typeof reason !== 'object' || !('fieldErrors' in reason)) return {}
  const value = (reason as AdminServiceError).fieldErrors
  return value && typeof value === 'object' ? value : {}
}

export interface AdminServices {
  getAuthState(): AdminAuthState
  subscribeAuth(listener: (state: AdminAuthState) => void): () => void
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  loadDashboardStats(): Promise<DashboardStats>
  listRecipes(): Promise<AdminRecipeDraft[]>
  getRecipe(id: string): Promise<AdminRecipeDraft | null>
  saveRecipe(recipe: AdminRecipeDraft): Promise<AdminRecipeDraft>
  publishRecipe(recipe: AdminRecipeDraft): Promise<AdminRecipeDraft>
  checkPublishReadiness(recipe: AdminRecipeDraft): Promise<PublishReadiness>
  requestVerification(recipeId: string): Promise<void>
  listRecipeVersions(recipeId: string): Promise<AdminRecipeVersion[]>
  restoreRecipeVersion(recipeId: string, versionId: string): Promise<AdminRecipeDraft>
  rebuildSearchIndex(): Promise<void>
  uploadImage(file: File): Promise<ImageUploadResult>
  getInventory(): Promise<{ sensors: Sensor[]; actuators: Actuator[] }>
  registerSensor(sensor: Sensor): Promise<void>
  getRationales(): Promise<SensorRationale[]>
  saveRationales(rationales: SensorRationale[]): Promise<void>
}

export const unavailableAdminServices: AdminServices = {
  getAuthState: () => ({ status: 'signed-out' }),
  subscribeAuth: () => () => undefined,
  signIn: async () => undefined,
  signOut: async () => undefined,
  loadDashboardStats: async () => ({ rows: [], failedTokens: [] }),
  listRecipes: async () => [],
  getRecipe: async () => null,
  saveRecipe: async (recipe) => recipe,
  publishRecipe: async (recipe) => ({ ...recipe, status: 'published' }),
  checkPublishReadiness: async () => ({ canPublish: false, issues: [] }),
  requestVerification: async () => undefined,
  listRecipeVersions: async () => [],
  restoreRecipeVersion: async () => { throw new Error('복원할 수 없습니다.') },
  rebuildSearchIndex: async () => undefined,
  uploadImage: async () => {
    throw new Error('이미지 업로드 서비스가 연결되지 않았습니다.')
  },
  getInventory: async () => ({ sensors: [], actuators: [] }),
  registerSensor: async () => undefined,
  getRationales: async () => [],
  saveRationales: async () => undefined,
}
