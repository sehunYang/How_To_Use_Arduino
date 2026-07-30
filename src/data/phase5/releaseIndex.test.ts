import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { buildIndex } from '@/search'
import { phase5Recipes } from '.'

describe('Phase 5 release index projection', () => {
  const releaseRecipes = phase5Recipes.map((recipe) => ({
    ...recipe,
    status: 'published' as const,
  }))
  const index = buildIndex(releaseRecipes)

  it('contains exactly the canonical 34 recipes without legacy canary duplicates', () => {
    expect(index).toHaveLength(34)
    expect(new Set(index.map((entry) => entry.id)).size).toBe(34)
    expect(index.some((entry) => entry.id === 'pendulum')).toBe(false)
    expect(index.some((entry) => entry.id === 'p1-pendulum-period')).toBe(true)
  })

  it('stays below the 150 KiB gzip release-index budget', () => {
    const bytes = gzipSync(JSON.stringify(index)).byteLength
    expect(bytes).toBeLessThanOrEqual(150 * 1024)
  })
})
