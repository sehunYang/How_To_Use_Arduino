import { describe, expect, it, vi } from 'vitest'
import { normalizeSearchTokens, sendAnonymousEvent } from './events'

describe('anonymous student telemetry', () => {
  it('sends only the anonymous allowlisted event shape', async () => {
    const transport = vi.fn().mockResolvedValue(undefined)
    await sendAnonymousEvent({ recipeId: 'pendulum', event: 'step_check', step: 2 }, transport)
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({
      recipeId: 'pendulum',
      event: 'step_check',
      step: 2,
      anonId: expect.any(String),
      at: expect.any(String),
    }))
    expect(Object.keys(transport.mock.calls[0][0]).sort()).toEqual(['anonId', 'at', 'event', 'recipeId', 'step'])
  })

  it('surfaces transport failure to the detached promise without changing the event contract', async () => {
    await expect(sendAnonymousEvent(
      { recipeId: 'pendulum', event: 'complete' },
      async () => { throw new Error('offline') },
    )).rejects.toThrow('offline')
  })

  it('normalizes failed searches to deduplicated tokens without retaining the raw sentence', () => {
    expect(normalizeSearchTokens('  진자가, 진자가! ROBOT-123  ')).toEqual(['진자가', 'robot', '123'])
  })
})
