import { describe, expect, it } from 'vitest'
import type { SearchIndexEntry, SensorRationale } from '@/schema'
import { aggregateSensors } from './aggregateSensors'

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
