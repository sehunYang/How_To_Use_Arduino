import { describe, it, expect } from 'vitest'
import type { SearchIndexEntry } from '@/schema'
import { pendulumRecipe, multiTsl2591Recipe } from '@/data/canary'
import { buildIndex, buildIndexEntry } from './buildIndexEntry'
import { search, type SynonymMap } from './index'

function stub(overrides: Partial<SearchIndexEntry> & Pick<SearchIndexEntry, 'id' | 'title' | 'coreKeywords'>): SearchIndexEntry {
  return {
    subject: '물리',
    difficulty: '중급',
    minutes: 40,
    sensors: [],
    actuators: [],
    imageUrl: 'wiring/stub.png',
    applicationGuideExcerpt: '이 레시피를 다른 탐구에 적용하는 방법입니다.',
    ...overrides,
  }
}

const synonyms: SynonymMap = {
  진자: ['추', '시계추', '흔들'],
  에너지: ['힘', '동력'],
  거리: ['간격'],
  온도: ['열', '따뜻'],
}

describe('buildIndexEntry / buildIndex', () => {
  it('includes a published recipe', () => {
    const entry = buildIndexEntry(pendulumRecipe)
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('pendulum')
  })

  it('excludes a draft recipe', () => {
    expect(buildIndexEntry({ ...multiTsl2591Recipe, status: 'draft' })).toBeNull()
  })

  it('includes the application guide needed by bundled search results', () => {
    expect(buildIndexEntry(pendulumRecipe)?.applicationGuideExcerpt).toBe(
      pendulumRecipe.applicationGuide,
    )
  })

  it('caps a long application guide to a 180-character excerpt', () => {
    const entry = buildIndexEntry({
      ...pendulumRecipe,
      applicationGuide: '가'.repeat(200),
    })

    expect(entry?.applicationGuideExcerpt).toHaveLength(180)
    expect(entry?.applicationGuideExcerpt.endsWith('…')).toBe(true)
  })

  it('buildIndex over a mixed set only contains published entries', () => {
    const index = buildIndex([pendulumRecipe, { ...multiTsl2591Recipe, status: 'draft' }])
    expect(index).toHaveLength(1)
    expect(index[0].id).toBe('pendulum')
  })
})

describe('search — dictionary + fuzzy pipeline', () => {
  // 5-entry index: the real published canary + 4 stubs, so minResults=3
  // guarantees are exercised against a realistic-sized corpus.
  const index: SearchIndexEntry[] = [
    buildIndexEntry(pendulumRecipe)!,
    stub({ id: 'free-fall', title: '자유낙하 가속도 g 구하기', coreKeywords: ['자유낙하', '가속도', '거리'] }),
    stub({ id: 'fan-control', title: '온습도에 따른 자동 환풍기 제어', coreKeywords: ['온도', '습도', '환풍기'] }),
    stub({ id: 'light-follow', title: '빛을 따라가는 자동차', coreKeywords: ['빛', '자동차', '조도'] }),
    stub({ id: 'rpm-meter', title: '바퀴 회전수 측정기', coreKeywords: ['회전수', '자석', 'RPM'] }),
  ]

  it('a query containing an exact core keyword ranks that recipe in the top 3', () => {
    const results = search('진자가 흔들릴 때 에너지가 보존되는지 알고 싶어요', index, synonyms)
    const top3Ids = results.slice(0, 3).map((r) => r.entry.id)
    expect(top3Ids).toContain('pendulum')
    expect(results[0].via).toBe('dictionary')
    expect(results[0].matchedKeywords.length).toBeGreaterThan(0)
  })

  it('a synonym-only query (no exact core keyword) still surfaces the recipe via dictionary scoring', () => {
    const results = search('시계추가 힘을 잃지 않는지 궁금해요', index, synonyms)
    expect(results.map((r) => r.entry.id)).toContain('pendulum')
  })

  it('a nonsense query still returns at least 3 results via the fuzzy fallback', () => {
    const results = search('asdkjqwoeiuraskjdf', index, synonyms)
    expect(results.length).toBeGreaterThanOrEqual(3)
    expect(results.every((result) => result.sensorEligible === false)).toBe(true)
  })

  it('never returns zero results for a non-empty index, regardless of query', () => {
    const queries = ['', 'ㅁㄴㅇㄹ', '완전히 무관한 문장입니다 123', '진자']
    for (const q of queries) {
      const results = search(q, index, synonyms)
      expect(results.length, `query: "${q}"`).toBeGreaterThanOrEqual(3)
    }
  })

  it('respects a custom minResults option', () => {
    const results = search('asdkjqwoeiuraskjdf', index, synonyms, { minResults: 2 })
    expect(results.length).toBeGreaterThanOrEqual(2)
  })
})
