// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import axe from 'axe-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App, { PAGE_LOADING_LABEL } from '@/App'

// 검색 결과는 두 갈래로 나뉩니다. 맞는 레시피가 있을 때와, 하나도 없어 비슷한 것만
// 내놓을 때입니다. 뒤쪽이 오래 빠져 있어서 제목만 있고 아래가 빈 화면을 놓쳤습니다.
const studentRoutes = [
  '/',
  '/search?q=%EC%A7%84%EC%9E%90',
  '/search?q=zzzqqqxyz',
  '/recipes',
  '/recipes/pendulum',
  '/sensors',
  '/data-analysis',
]
const themes = ['light', 'dark'] as const

// 화면은 필요할 때 내려받으므로 이 검사는 실제 import가 끝나기를 기다립니다.
// 레시피 상세는 수식·마크다운·부품 그림을 함께 받아 와 단독 실행에서도 몇 초가
// 걸리고, 전체 테스트를 한꺼번에 돌릴 때는 기본 제한 5초를 넘깁니다. 기다리는
// 시간(WAIT)보다 테스트 제한(TIMEOUT)을 넉넉히 크게 두어야 대기가 끝나기 전에
// 테스트가 먼저 끊기지 않습니다.
const LAZY_ROUTE_WAIT = 15_000
const LAZY_ROUTE_TIMEOUT = 60_000

beforeEach(() => {
  window.localStorage.clear()
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  Element.prototype.scrollIntoView = vi.fn()
  // jsdom은 스크롤을 구현하지 않아 호출마다 경고를 냅니다. 실제 실패를 가립니다.
  window.scrollBy = vi.fn()
})

afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.theme
})

describe('Phase 3 WCAG AA automated checks', () => {
  for (const theme of themes) {
    for (const route of studentRoutes) {
      it(`${theme} theme has no detectable WCAG A/AA violations at ${route}`, async () => {
        document.documentElement.dataset.theme = theme
        window.history.replaceState({}, '', route)
        const { container, queryByText } = render(<App />)
        // 화면은 필요할 때 내려받으므로, 자리 표시가 사라진 뒤에 검사해야 실제
        // 화면이 검사 대상이 됩니다. 앞선 검사에서 이미 받아 둔 화면은 자리
        // 표시 없이 바로 그려지므로, '사라질 때까지'가 아니라 '없을 때까지'를
        // 기다려야 두 경우를 모두 통과합니다.
        await waitFor(
          () => expect(queryByText(PAGE_LOADING_LABEL)).not.toBeInTheDocument(),
          { timeout: LAZY_ROUTE_WAIT },
        )

        const result = await axe.run(container, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
          },
          // jsdom does not calculate painted colors or element geometry.
          rules: {
            'color-contrast': { enabled: false },
            // 제목 단계 건너뛰기는 WCAG 태그가 붙지 않아 이 검사에서 오래 빠져 있었습니다.
            // 목록 화면들이 h1 다음에 곧바로 카드의 h3를 내놓고 있었습니다.
            'heading-order': { enabled: true },
          },
        })

        expect(
          result.violations,
          result.violations.map((violation) => `${violation.id}: ${violation.help}`).join('\n'),
        ).toEqual([])
      }, LAZY_ROUTE_TIMEOUT)
    }
  }

  it('lets keyboard users jump past the header and menu to the page body', async () => {
    window.history.replaceState({}, '', '/')
    const { container, queryByText } = render(<App />)
    await waitFor(
      () => expect(queryByText(PAGE_LOADING_LABEL)).not.toBeInTheDocument(),
      { timeout: LAZY_ROUTE_WAIT },
    )

    const skip = container.querySelector('a[href="#main-content"]')
    expect(skip).toBeInTheDocument()
    // 건너뛰기 링크는 머리글보다 먼저 나와야 첫 Tab에서 닿습니다.
    expect(container.querySelector('a, button')).toBe(skip)
    expect(container.querySelector('#main-content')?.tagName).toBe('MAIN')
  }, LAZY_ROUTE_TIMEOUT)
})
