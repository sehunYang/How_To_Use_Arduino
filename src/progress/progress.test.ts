import { describe, expect, it } from 'vitest'
import { loadProgress, progressKey, saveProgress } from './index'
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
