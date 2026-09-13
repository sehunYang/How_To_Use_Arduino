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
    question: '',
    ...overrides,
  }
}

const synonyms: SynonymMap = {
  진자: ['추', '시계추', '흔들'],
  에너지: ['힘', '동력'],
  거리: ['간격'],
  온도: ['열', '따뜻'],
  빛: ['조도', '밝기'],
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

describe('search: dictionary + fuzzy pipeline', () => {
  // 5-entry index: the real published canary + 4 stubs, so minResults=3
  // guarantees are exercised against a realistic-sized corpus.
  const index: SearchIndexEntry[] = [
    buildIndexEntry(pendulumRecipe)!,
    stub({ id: 'damping', title: '진자의 감쇠와 에너지 손실률', coreKeywords: ['단진자', '감쇠', '진폭'] }),
    stub({ id: 'free-fall', title: '자유낙하 가속도 g 구하기', coreKeywords: ['자유낙하', '가속도', '거리'] }),
    stub({ id: 'fan-control', title: '온습도에 따른 자동 환풍기 제어', coreKeywords: ['온도', '습도', '환풍기'] }),
    stub({ id: 'light-follow', title: '빛을 따라가는 자동차', coreKeywords: ['빛', '자동차', '조도'] }),
    stub({ id: 'rpm-meter', title: '바퀴 회전수 측정기', coreKeywords: ['회전수', '자석', 'RPM'] }),
    stub({ id: 'inertia', title: '회전 관성과 각속도', coreKeywords: ['각속도', '관성'] }),
    stub({ id: 'drag', title: '낙하 물체의 공기 저항', coreKeywords: ['공기 저항', '종단 속도'] }),
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

  it('"속도"를 적은 질문은 "가속도" 레시피를 찾았다고 하지 않는다', () => {
    // 냉각 속도·낙하 속도를 묻는 문장마다 진자 레시피가 "찾았습니다"로 올라왔습니다.
    const results = search('물의 양에 따라 식는 속도가 달라질까', index, synonyms)
    const confident = results.filter((r) => r.via === 'dictionary').map((r) => r.entry.id)
    expect(confident).not.toContain('pendulum')
    expect(confident).not.toContain('free-fall')
    expect(confident).not.toContain('inertia')
    expect(search('저항을 바꾸면 전류가 어떻게 달라질까', index, synonyms).filter((r) => r.via === 'dictionary').map((r) => r.entry.id)).not.toContain('drag')
    // 뜻이 이어지는 짝("진자" ⊂ "단진자")은 그대로 찾습니다.
    expect(search('진자', index, synonyms)[0].via).toBe('dictionary')
  })

  it('a query more general than the keyword ("진자" vs "단진자") matches via dictionary, not fuzzy', () => {
    const results = search('진자', index, synonyms)
    const damping = results.find((r) => r.entry.id === 'damping')
    expect(damping).toBeDefined()
    expect(damping!.via).toBe('dictionary')
    expect(damping!.matchedKeywords).toContain('단진자')
  })

  it('a particle-suffixed sentence ("진자의 …") still reaches recipes keyed 단진자 in the top 3', () => {
    const results = search('진자의 움직임을 측정하고 싶어요', index, synonyms)
    const top3Ids = results.slice(0, 3).map((r) => r.entry.id)
    expect(top3Ids).toContain('damping')
  })

  it('synonym groups are symmetric: a sibling variant ("밝기") reaches a recipe keyed by another variant ("조도")', () => {
    const results = search('교실이 얼마나 밝기가 다른지 재고 싶어요', index, synonyms)
    const lightFollow = results.find((r) => r.entry.id === 'light-follow')
    expect(lightFollow).toBeDefined()
    expect(lightFollow!.via).toBe('dictionary')
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
