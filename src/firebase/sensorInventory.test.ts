import { describe, expect, it } from 'vitest'
import { sensors } from '@/data/inventory-seed/sensors'
import { parseSensorInventory } from './sensorInventory'

describe('parseSensorInventory', () => {
  it('accepts the owned sensor inventory contract', () => {
    expect(parseSensorInventory(sensors)).toHaveLength(10)
  })

  it('rejects malformed remote records before replacing the bundled fallback', () => {
    expect(() => parseSensorInventory([{ id: 'broken' }])).toThrow()
  })
})
