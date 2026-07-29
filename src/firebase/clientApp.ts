import type { FirebaseApp } from 'firebase/app'

let appPromise: Promise<FirebaseApp | null> | null = null
let appCheckPromise: Promise<boolean> | null = null

export function getClientApp(): Promise<FirebaseApp | null> {
  if (appPromise) return appPromise
  appPromise = (async () => {
    const { VITE_FIREBASE_API_KEY: apiKey, VITE_FIREBASE_PROJECT_ID: projectId, VITE_FIREBASE_APP_ID: appId } = import.meta.env
    if (!apiKey || !projectId || !appId) return null
    const { getApp, getApps, initializeApp } = await import('firebase/app')
    return getApps().length ? getApp() : initializeApp({ apiKey, projectId, appId })
  })()
  return appPromise
}

export function ensureAppCheck(app: FirebaseApp): Promise<boolean> {
  if (appCheckPromise) return appCheckPromise
  appCheckPromise = (async () => {
    const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY
    if (!siteKey) return false
    const { ReCaptchaV3Provider, getToken, initializeAppCheck } = await import('firebase/app-check')
    const appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    })
    await getToken(appCheck, false)
    return true
  })()
  return appCheckPromise
}
