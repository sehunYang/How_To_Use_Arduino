import { describe, expect, it } from 'vitest'
import { sensors } from '@/data/inventory-seed/sensors'
import { mergeSensorInventory, parseSensorInventory } from './sensorInventory'

describe('parseSensorInventory', () => {
  it('accepts the owned sensor inventory contract', () => {
    expect(parseSensorInventory(sensors)).toHaveLength(10)
  })

  it('rejects malformed remote records before replacing the bundled fallback', () => {
    expect(() => parseSensorInventory([{ id: 'broken' }])).toThrow()
  })
})

describe('mergeSensorInventory', () => {
  it('adds an eleventh remotely registered sensor and preserves bundled sensors', () => {
    const remote = { ...sensors[0], id: 'sensor-11', name: '새 센서' }
    const merged = mergeSensorInventory(sensors, [remote])

    expect(merged).toContainEqual(remote)
    expect(merged).toHaveLength(sensors.length + 1)
  })

  it('uses a remote record as the current version of an existing sensor', () => {
    const remote = { ...sensors[0], name: '수정된 센서' }
    const merged = mergeSensorInventory(sensors, [remote])

    expect(merged.filter((sensor) => sensor.id === remote.id)).toEqual([remote])
  })
})
