import { describe, expect, it } from 'vitest'
import { SensorRationaleSchema } from '@/schema'
import { phase5Rationales } from './rationales'

describe('Phase 5 sensor rationales', () => {
  it('contains unique, schema-valid sensor and subject pairs', () => {
    const keys = new Set<string>()
    for (const rationale of phase5Rationales) {
      expect(SensorRationaleSchema.safeParse(rationale).success).toBe(true)
      const key = `${rationale.sensorId}:${rationale.subject}`
      expect(keys.has(key), key).toBe(false)
      keys.add(key)
    }
  })

  it('uses explanatory text rather than placeholder labels', () => {
    expect(phase5Rationales.length).toBeGreaterThanOrEqual(19)
    for (const rationale of phase5Rationales) {
      expect(rationale.whyText.length, `${rationale.sensorId}:${rationale.subject}`).toBeGreaterThan(35)
    }
  })
})
