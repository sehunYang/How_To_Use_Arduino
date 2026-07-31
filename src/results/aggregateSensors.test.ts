import { describe, expect, it } from 'vitest'
import type { SearchIndexEntry, SensorRationale } from '@/schema'
import { aggregateSensors, rankSensors } from './aggregateSensors'
import type { SearchResult } from '@/search'
import { sensors } from '@/data/inventory-seed/sensors'
import { canaryRationales } from '@/data/canary'

function entry(
  id: string,
  sensors: string[],
  subject: SearchIndexEntry['subject'],
): SearchIndexEntry {
  return {
    id,
    title: id,
    subject,
    difficulty: '중급',
    minutes: 30,
    sensors,
    actuators: [],
    coreKeywords: [],
    imageUrl: `/wiring/${id}.png`,
    applicationGuideExcerpt: `${id} 응용 가이드`,
  }
}

const rationales: SensorRationale[] = [
  {
    sensorId: 'mpu6050',
    subject: '물리',
    whyText: '움직임을 측정해 물리 현상을 분석할 수 있습니다.',
  },
  {
    sensorId: 'mpu6050',
    subject: null,
    whyText: '움직임을 측정할 수 있습니다.',
  },
  {
    sensorId: 'ina219',
    subject: null,
    whyText: '전류와 전력을 측정할 수 있습니다.',
  },
]

describe('aggregateSensors', () => {
  it('returns each sensor only once in first-seen order', () => {
    const result = aggregateSensors(
      [
        entry('first', ['mpu6050', 'ina219'], '물리'),
        entry('second', ['mpu6050'], '공학·로봇'),
      ],
      rationales,
    )

    expect(result.map(({ sensorId }) => sensorId)).toEqual(['mpu6050', 'ina219'])
  })

  it('prefers a subject-specific rationale', () => {
    const [sensor] = aggregateSensors(
      [entry('pendulum', ['mpu6050'], '물리')],
      rationales,
    )

    expect(sensor.whyText).toBe(
      '움직임을 측정해 물리 현상을 분석할 수 있습니다.',
    )
  })

  it('falls back to a subject-neutral rationale', () => {
    const [sensor] = aggregateSensors(
      [entry('robot', ['mpu6050'], '공학·로봇')],
      rationales,
    )

    expect(sensor.whyText).toBe('움직임을 측정할 수 있습니다.')
  })

  it('rejects a displayed sensor without a rationale', () => {
    expect(() =>
      aggregateSensors(
        [entry('unknown', ['missing-sensor'], '물리')],
        rationales,
      ),
    ).toThrow('missing-sensor')
  })
})

describe('rankSensors', () => {
  function result(
    recipe: SearchIndexEntry,
    relevanceScore: number,
    sensorEligible = true,
  ): SearchResult {
    return {
      entry: recipe,
      matchedKeywords: [],
      via: 'dictionary',
      relevanceScore,
      sensorEligible,
    }
  }

  it('ranks a repeatedly recommended sensor above a one-off sensor', () => {
    const ranked = rankSensors(
      [
        result(entry('first', ['mpu6050', 'ina219'], '물리'), 3),
        result(entry('second', ['mpu6050'], '공학·로봇'), 2),
      ],
      rationales,
    )

    expect(ranked.map((sensor) => sensor.sensorId)).toEqual(['mpu6050', 'ina219'])
    expect(ranked[0].recipeCount).toBe(2)
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score)
  })

  it('excludes sensors from recipes added only as zero-relevance padding', () => {
    const ranked = rankSensors(
      [
        result(entry('matched', ['mpu6050'], '물리'), 3),
        result(entry('padding', ['ina219'], '물리'), 0, false),
      ],
      rationales,
    )

    expect(ranked.map((sensor) => sensor.sensorId)).toEqual(['mpu6050'])
  })

  it('downweights an infrastructure part relative to the measuring sensor', () => {
    const extendedRationales: SensorRationale[] = [
      ...rationales,
      { sensorId: 'tca9548a', subject: null, whyText: 'I2C 연결을 확장합니다.' },
    ]
    const ranked = rankSensors(
      [result(entry('multi-light', ['tca9548a', 'mpu6050'], '물리'), 3)],
      extendedRationales,
    )

    expect(ranked.map((sensor) => sensor.sensorId)).toEqual(['mpu6050', 'tca9548a'])
  })

  it('has a student-facing rationale for every published inventory sensor', () => {
    const missing = sensors
      .map((sensor) => sensor.id)
      .filter((sensorId) => !canaryRationales.some((item) => item.sensorId === sensorId))

    expect(missing).toEqual([])
    expect(() => rankSensors(
      [result(entry('all-sensors', sensors.map((sensor) => sensor.id), '물리'), 3)],
      canaryRationales,
    )).not.toThrow()
  })
})
