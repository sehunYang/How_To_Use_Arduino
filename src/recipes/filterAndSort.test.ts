import { describe, expect, it } from 'vitest'
import type { SearchIndexEntry } from '@/schema'
import { filterAndSortRecipes } from './filterAndSort'

function entry(
  id: string,
  overrides: Partial<SearchIndexEntry> = {},
): SearchIndexEntry {
  return {
    id,
    title: id,
    subject: '물리',
    difficulty: '중급',
    minutes: 30,
    sensors: [],
    actuators: [],
    coreKeywords: [],
    imageUrl: `/wiring/${id}.png`,
    applicationGuideExcerpt: `${id} 응용 가이드`,
    ...overrides,
  }
}

const recipes = [
  entry('third', {
    title: '다 레시피',
    difficulty: '고급',
    minutes: 50,
    sensors: ['ina219'],
  }),
  entry('first', {
    title: '가 레시피',
    subject: '공학·로봇',
    difficulty: '초급',
    minutes: 10,
    sensors: ['mpu6050'],
  }),
  entry('second', {
    title: '나 레시피',
    difficulty: '중급',
    minutes: 30,
    sensors: ['mpu6050'],
  }),
]

describe('filterAndSortRecipes', () => {
  it('applies subject, difficulty, and sensor filters together', () => {
    const result = filterAndSortRecipes(recipes, {
      subject: '물리',
      difficulty: '중급',
      sensor: 'mpu6050',
    })

    expect(result.map(({ id }) => id)).toEqual(['second'])
  })

  it('preserves source order when sorting by relevance', () => {
    expect(
      filterAndSortRecipes(recipes, {}, 'relevance').map(({ id }) => id),
    ).toEqual(['third', 'first', 'second'])
  })

  it('sorts by shortest duration without mutating the source', () => {
    const originalOrder = recipes.map(({ id }) => id)
    const result = filterAndSortRecipes(recipes, {}, 'minutes-asc')

    expect(result.map(({ id }) => id)).toEqual(['first', 'second', 'third'])
    expect(recipes.map(({ id }) => id)).toEqual(originalOrder)
  })

  it('sorts by difficulty from beginner to advanced', () => {
    expect(
      filterAndSortRecipes(recipes, {}, 'difficulty-asc').map(({ id }) => id),
    ).toEqual(['first', 'second', 'third'])
  })

  it('sorts titles using Korean collation', () => {
    expect(
      filterAndSortRecipes(recipes, {}, 'title').map(({ id }) => id),
    ).toEqual(['first', 'second', 'third'])
  })
})
