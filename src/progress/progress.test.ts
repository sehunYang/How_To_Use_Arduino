import { describe, expect, it } from 'vitest'
import { clearTrials, loadLatestTrialsScope, loadProgress, loadTrials, progressKey, saveProgress, saveTrials, trialsKey, TRIALS_VERSION, type SavedTrials } from './index'
import { wiringReducer } from '@/hooks/useWiringSteps'

describe('progress and wiring state', () => {
  it('round-trips versioned progress and resizes safely', () => {
    const storage = new Map<string, string>(); const s = { getItem: (k:string) => storage.get(k) ?? null, setItem: (k:string,v:string) => { storage.set(k,v) } } as unknown as Storage
    const p = loadProgress('r', 2, s); p.checked[1] = true; saveProgress(p, s)
    expect(loadProgress('r', 3, s).checked).toEqual([false, true, false]); expect(storage.has(progressKey('r'))).toBe(true)
  })
  it('supports check, uncheck, active and completion state', () => {
    let s: import('@/hooks/useWiringSteps').WiringState = { checked: [false, false], activeStep: 0 }; s = wiringReducer(s, { type: 'check', step: 0 }); s = wiringReducer(s, { type: 'check', step: 1 }); expect(s.checked.every(Boolean)).toBe(true); s = wiringReducer(s, { type: 'uncheck', step: 0 }); expect(s.checked).toEqual([false, true]); expect(wiringReducer(s, { type: 'active', step: 1 }).activeStep).toBe(1)
  })
})

describe('saved trials', () => {
  function memoryStorage() {
    const map = new Map<string, string>()
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => { map.set(key, value) },
      removeItem: (key: string) => { map.delete(key) },
      keys: () => [...map.keys()],
    } as unknown as Storage & { keys: () => string[] }
  }

  const saved: SavedTrials = {
    version: TRIALS_VERSION,
    recipeId: 'pendulum',
    baudRate: 115200,
    hint: { expectedHeader: ['time_ms', 'accel_x_raw'], sensors: ['mpu6050'], recipeId: 'pendulum', title: '단진자' },
    trials: [{ id: 1, label: '1회차', header: ['time_ms', 'accel_x_raw'], rows: [['0', '16384']], manualValues: { length_cm: '20' } }],
    xName: 'time_ms',
    yNames: ['accel_x_raw'],
    manualNames: ['length_cm'],
    calculatedColumns: [{ name: 'g', expression: 'accel_x_raw / 16384' }],
    level: 'advanced',
    updatedAt: '2026-09-13T00:00:00.000Z',
  }

  it('회차와 축 선택을 통째로 되살리고, 마지막으로 쓴 레시피를 기억한다', () => {
    const storage = memoryStorage()
    expect(saveTrials(saved, storage)).toBe(true)
    expect(loadTrials('pendulum', storage)).toEqual(saved)
    expect(loadLatestTrialsScope(storage)).toBe('pendulum')
  })

  it('레시피마다 따로 두어, 다른 레시피를 저장해도 앞 레시피의 회차가 남는다', () => {
    const storage = memoryStorage()
    saveTrials(saved, storage)
    saveTrials({ ...saved, recipeId: 'cooling-curve', trials: [] }, storage)
    expect(loadTrials('pendulum', storage)?.trials).toHaveLength(1)
    expect(loadLatestTrialsScope(storage)).toBe('cooling-curve')
    clearTrials('cooling-curve', storage)
    expect(loadTrials('cooling-curve', storage)).toBeNull()
    expect(loadTrials('pendulum', storage)?.trials).toHaveLength(1)
    expect(loadLatestTrialsScope(storage)).toBeNull()
  })

  it('버전이 다르거나 망가진 값은 없는 것으로 보고, 빠진 칸은 채운다', () => {
    const storage = memoryStorage()
    storage.setItem(trialsKey('pendulum'), JSON.stringify({ version: 99, trials: [] }))
    expect(loadTrials('pendulum', storage)).toBeNull()
    storage.setItem(trialsKey('pendulum'), '{not json')
    expect(loadTrials('pendulum', storage)).toBeNull()
    storage.setItem(trialsKey('pendulum'), JSON.stringify({ ...saved, trials: [null, { id: 'x' }, { id: 2, header: ['a'], rows: [['1']] }] }))
    expect(loadTrials('pendulum', storage)?.trials).toEqual([{ id: 2, label: '3회차', header: ['a'], rows: [['1']], manualValues: {} }])
  })

  it('저장소에 들어가지 않을 만큼 크면 옛 사본까지 지우고 저장하지 않았다고 답한다', () => {
    const storage = memoryStorage()
    saveTrials(saved, storage)
    const huge = { ...saved, trials: [{ ...saved.trials[0], rows: Array.from({ length: 200_000 }, () => ['1234567', '1234567']) }] }
    expect(saveTrials(huge, storage)).toBe(false)
    expect(loadTrials('pendulum', storage)).toBeNull()
  })
})
