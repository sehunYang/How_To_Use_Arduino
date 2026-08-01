// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CACHE_BUST_PARAM, reloadBypassingCache, stripCacheBustParam } from './cacheBust'

const realLocation = window.location

function stubLocation(href: string) {
  const replace = vi.fn()
  Object.defineProperty(window, 'location', { configurable: true, value: { href, replace } })
  return replace
}

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
  window.history.replaceState({}, '', '/')
})

describe('reloadBypassingCache', () => {
  it('reopens the same address with a marker so the cached index.html is skipped', () => {
    const replace = stubLocation('https://example.test/search?q=%EC%A7%84%EC%9E%90')

    reloadBypassingCache(1_700_000_000_000)

    const target = new URL(replace.mock.calls[0][0])
    expect(target.pathname).toBe('/search')
    expect(target.searchParams.get('q')).toBe('진자')
    expect(target.searchParams.get(CACHE_BUST_PARAM)).toBe('1700000000000')
  })

  it('replaces the marker instead of stacking a new one on every attempt', () => {
    const replace = stubLocation(`https://example.test/search?q=1&${CACHE_BUST_PARAM}=111`)

    reloadBypassingCache(222)

    const target = new URL(replace.mock.calls[0][0])
    expect(target.searchParams.getAll(CACHE_BUST_PARAM)).toEqual(['222'])
  })
})

describe('stripCacheBustParam', () => {
  it('takes the marker back out of the address bar and keeps the rest', () => {
    window.history.replaceState({}, '', `/search?q=%EC%A7%84%EC%9E%90&${CACHE_BUST_PARAM}=123`)

    stripCacheBustParam()

    expect(window.location.search).toBe('?q=%EC%A7%84%EC%9E%90')
    expect(new URLSearchParams(window.location.search).get('q')).toBe('진자')
  })

  it('leaves an ordinary address untouched', () => {
    window.history.replaceState({}, '', '/recipes?subject=%EB%AC%BC%EB%A6%AC')

    stripCacheBustParam()

    expect(window.location.search).toBe('?subject=%EB%AC%BC%EB%A6%AC')
  })
})
