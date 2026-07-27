import { describe, expect, it, vi } from 'vitest'
import { createCiAppCheckProvider } from './ciAppCheckProvider'

describe('createCiAppCheckProvider', () => {
  it('exchanges the registered CI debug token without exposing it in the URL', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ token: 'app-check-token', ttl: '3600s' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const provider = createCiAppCheckProvider({
      projectId: 'project-id',
      appId: '1:123:web:abc',
      apiKey: 'api-key',
      debugToken: 'debug-secret',
      fetchImpl,
      now: () => 1_000,
    })

    await expect(provider.getToken()).resolves.toEqual({
      token: 'app-check-token',
      expireTimeMillis: 3_601_000,
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://firebaseappcheck.googleapis.com/v1/projects/project-id/apps/1%3A123%3Aweb%3Aabc:exchangeDebugToken?key=api-key',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ debugToken: 'debug-secret' }),
      }),
    )
    expect(String(fetchImpl.mock.calls[0]?.[0])).not.toContain('debug-secret')
  })

  it('fails closed when the exchange is rejected', async () => {
    const provider = createCiAppCheckProvider({
      projectId: 'project-id',
      appId: 'app-id',
      apiKey: 'api-key',
      debugToken: 'debug-secret',
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 })),
    })

    await expect(provider.getToken()).rejects.toThrow(
      'Firebase App Check debug-token exchange failed (403).',
    )
  })
})
