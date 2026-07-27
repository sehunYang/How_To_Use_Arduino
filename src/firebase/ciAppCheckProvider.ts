interface AppCheckExchangeResponse {
  token?: unknown
  ttl?: unknown
}

interface CiAppCheckProviderOptions {
  projectId: string
  appId: string
  apiKey: string
  debugToken: string
  fetchImpl?: typeof fetch
  now?: () => number
}

function ttlToMilliseconds(ttl: unknown): number {
  if (typeof ttl !== 'string' || !/^\d+(?:\.\d+)?s$/.test(ttl)) {
    throw new Error('Firebase App Check returned an invalid token TTL.')
  }

  const milliseconds = Number.parseFloat(ttl.slice(0, -1)) * 1000
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    throw new Error('Firebase App Check returned an invalid token TTL.')
  }
  return milliseconds
}

/**
 * Creates the Node-compatible App Check provider used by the queue-drain CI
 * identity. The debug token must be registered for appId in Firebase App
 * Check and supplied only through the CI secret store.
 */
export function createCiAppCheckProvider({
  projectId,
  appId,
  apiKey,
  debugToken,
  fetchImpl = fetch,
  now = Date.now,
}: CiAppCheckProviderOptions): { getToken: () => Promise<{ token: string; expireTimeMillis: number }> } {
  return {
    async getToken() {
      const appResource = `projects/${encodeURIComponent(projectId)}/apps/${encodeURIComponent(appId)}`
      const response = await fetchImpl(
        `https://firebaseappcheck.googleapis.com/v1/${appResource}:exchangeDebugToken?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ debugToken }),
        },
      )

      if (!response.ok) {
        throw new Error(`Firebase App Check debug-token exchange failed (${response.status}).`)
      }

      const result = (await response.json()) as AppCheckExchangeResponse
      if (typeof result.token !== 'string' || result.token.length === 0) {
        throw new Error('Firebase App Check did not return a token.')
      }

      return {
        token: result.token,
        expireTimeMillis: now() + ttlToMilliseconds(result.ttl),
      }
    },
  }
}
