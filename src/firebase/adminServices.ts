import type {
  AdminAuthState,
  AdminRecipeDraft,
  AdminServiceError,
  AdminServices,
  ImageUploadResult,
} from '@/admin/AdminServices'
import { actuators } from '@/data/inventory-seed/actuators'
import { computeInventoryVersion } from '@/lib/verifyHash'
import type { Inventory } from '@/validation/staticCheck'
import {
  AuthoringValidationError,
  checkRecipePublish,
  getAdminSession,
  listAdminRecipes,
  listSensorRationales,
  loadAdminRecipe,
  loadDashboardStats,
  loadFailedSearchTokens,
  publishRecipe,
  rebuildSearchIndex,
  requestRecipeVerification,
  restoreRecipeVersion,
  saveRecipeDraft,
  saveSensor,
  saveSensorRationale,
  signInAdmin,
  signOutAdmin,
  uploadWiringImage,
  listRecipeVersions,
} from './adminRepository'
import { getClientApp } from './clientApp'
import { loadSensorInventory } from './sensorInventory'

let authState: AdminAuthState = { status: 'loading' }

function normalizeDraft(recipe: AdminRecipeDraft): AdminRecipeDraft {
  return recipe
}

async function inventory(): Promise<Inventory> {
  return { sensors: await loadSensorInventory(), actuators }
}

async function inventoryContext() {
  const current = await inventory()
  return {
    inventory: current,
    inventoryVersion: computeInventoryVersion(current),
  }
}

function validationError(reason: unknown): unknown {
  if (!(reason instanceof AuthoringValidationError)) return reason
  const error = new Error(reason.message) as AdminServiceError
  error.fieldErrors = Object.fromEntries(
    Object.entries(reason.validation.fieldErrors)
      .map(([path, messages]) => [path, messages.join(' ')]),
  )
  return error
}

async function imageDimensions(file: File): Promise<Pick<ImageUploadResult, 'width' | 'height'>> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('이미지 크기를 읽지 못했습니다.'))
      image.src = url
    })
    return { width: image.naturalWidth, height: image.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const firebaseAdminServices: AdminServices = {
  getAuthState: () => authState,
  subscribeAuth(listener) {
    let unsubscribe: () => void = () => undefined
    let active = true
    void getClientApp().then(async (app) => {
      if (!active) return
      if (!app) {
        authState = { status: 'signed-out' }
        listener(authState)
        return
      }
      const { getAuth, onAuthStateChanged } = await import('firebase/auth')
      unsubscribe = onAuthStateChanged(getAuth(app), async (user) => {
        if (!active) return
        if (!user) {
          authState = { status: 'signed-out' }
        } else {
          const session = await getAdminSession(true)
          authState = session
            ? { status: 'admin', email: user.email ?? '' }
            : { status: 'access-denied', email: user.email ?? undefined }
        }
        listener(authState)
      })
    }).catch(() => {
      authState = { status: 'signed-out' }
      listener(authState)
    })
    return () => {
      active = false
      unsubscribe()
    }
  },
  async signIn(email, password) {
    const session = await signInAdmin(email, password)
    authState = { status: 'admin', email: session.user.email ?? email }
  },
  async signOut() {
    await signOutAdmin()
    authState = { status: 'signed-out' }
  },
  async loadDashboardStats() {
    const [rows, failedTokens] = await Promise.all([
      loadDashboardStats(),
      loadFailedSearchTokens(),
    ])
    return {
      rows,
      failedTokens,
    }
  },
  async listRecipes() {
    return listAdminRecipes()
  },
  async getRecipe(id) {
    return loadAdminRecipe(id)
  },
  async saveRecipe(recipe) {
    const context = await inventoryContext()
    try {
      const result = await saveRecipeDraft(recipe, context.inventory, context.inventoryVersion)
      return normalizeDraft(result.recipe as AdminRecipeDraft)
    } catch (reason) {
      throw validationError(reason)
    }
  },
  async publishRecipe(recipe) {
    const context = await inventoryContext()
    try {
      const result = await publishRecipe(recipe, context.inventory, context.inventoryVersion)
      return normalizeDraft(result.recipe as AdminRecipeDraft)
    } catch (reason) {
      throw validationError(reason)
    }
  },
  async checkPublishReadiness(recipe) {
    const context = await inventoryContext()
    const validation = await checkRecipePublish(recipe, context.inventory, context.inventoryVersion)
    return { canPublish: validation.canPublish, issues: validation.issues }
  },
  async requestVerification(recipeId) {
    const recipe = await loadAdminRecipe(recipeId)
    if (!recipe) throw new Error('검증할 레시피를 찾지 못했습니다.')
    const context = await inventoryContext()
    await requestRecipeVerification(recipe, context.inventoryVersion)
  },
  async listRecipeVersions(recipeId) {
    return listRecipeVersions(recipeId)
  },
  async restoreRecipeVersion(recipeId, versionId) {
    const context = await inventoryContext()
    const result = await restoreRecipeVersion(
      recipeId,
      versionId,
      context.inventory,
      context.inventoryVersion,
    )
    return result.recipe as AdminRecipeDraft
  },
  async rebuildSearchIndex() {
    await rebuildSearchIndex()
  },
  async uploadImage(file) {
    const dimensions = await imageDimensions(file)
    const url = await uploadWiringImage('_drafts', file, file.name)
    return { url, ...dimensions }
  },
  async getInventory() {
    return inventory()
  },
  async registerSensor(sensor) {
    await saveSensor(sensor)
  },
  async getRationales() {
    return listSensorRationales()
  },
  async saveRationales(rationales) {
    await Promise.all(rationales.map((rationale) => saveSensorRationale(rationale)))
  },
}
