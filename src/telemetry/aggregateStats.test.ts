import { describe, expect, it } from 'vitest'
import type { AnonEvent, Stats } from '@/schema'
import { applyEventBatch, sessionKey, type LearningSession } from './aggregateStats'

const at = (minute: number) => `2026-07-29T00:${String(minute).padStart(2, '0')}:00.000Z`
const event = (overrides: Partial<AnonEvent> & Pick<AnonEvent, 'anonId' | 'recipeId' | 'event'>): AnonEvent => ({
  at: at(0),
  ...overrides,
})

describe('applyEventBatch', () => {
  it('moves a dropout between steps and removes it when the learner completes in later runs', () => {
    const first = applyEventBatch([
      event({ anonId: 'a', recipeId: 'pendulum', event: 'start', at: at(1) }),
      event({ anonId: 'a', recipeId: 'pendulum', event: 'step_check', step: 0, at: at(2) }),
    ], new Map(), new Map())
    expect(first.stats.get('pendulum')).toMatchObject({
      started: 1,
      completed: 0,
      dropAtStep: { 0: 1 },
    })

    const second = applyEventBatch([
      event({ anonId: 'a', recipeId: 'pendulum', event: 'step_check', step: 2, at: at(3) }),
    ], first.stats, first.sessions)
    expect(second.stats.get('pendulum')?.dropAtStep).toEqual({ 2: 1 })

    const third = applyEventBatch([
      event({ anonId: 'a', recipeId: 'pendulum', event: 'complete', at: at(4) }),
    ], second.stats, second.sessions)
    expect(third.stats.get('pendulum')).toEqual({
      started: 1,
      completed: 1,
      dropAtStep: {},
      processedThrough: at(4),
    })
  })

  it('preserves unique sessions and produces the same result across batch boundaries', () => {
    const events: AnonEvent[] = [
      event({ anonId: 'a', recipeId: 'one', event: 'start', at: at(1) }),
      event({ anonId: 'a', recipeId: 'one', event: 'start', at: at(2) }),
      event({ anonId: 'a', recipeId: 'one', event: 'complete', at: at(3) }),
      event({ anonId: 'b', recipeId: 'one', event: 'step_check', step: 1, at: at(4) }),
      event({ anonId: 'a', recipeId: 'search', event: 'search_fail', tokens: ['x'], at: at(5) }),
    ]
    const allAtOnce = applyEventBatch(events, new Map(), new Map())
    const first = applyEventBatch(events.slice(0, 2), new Map(), new Map())
    const split = applyEventBatch(events.slice(2), first.stats, first.sessions)

    expect([...split.stats]).toEqual([...allAtOnce.stats])
    expect([...split.sessions]).toEqual([...allAtOnce.sessions])
    expect(split.stats.get('one')).toMatchObject({ started: 2, completed: 1, dropAtStep: { 1: 1 } })
    expect(split.stats.has('search')).toBe(false)
  })

  it('continues correctly from persisted stats and session state', () => {
    const stats = new Map<string, Stats>([['r', {
      started: 3, completed: 1, dropAtStep: { 2: 1 }, processedThrough: at(2),
    }]])
    const sessions = new Map<string, LearningSession>([
      [sessionKey('r', 'learner'), { completed: false, lastCheckedStep: 2 }],
    ])
    const result = applyEventBatch([
      event({ anonId: 'learner', recipeId: 'r', event: 'complete', at: at(3) }),
    ], stats, sessions)
    expect(result.stats.get('r')).toEqual({
      started: 3, completed: 2, dropAtStep: {}, processedThrough: at(3),
    })
  })
})
