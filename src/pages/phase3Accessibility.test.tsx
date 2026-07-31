// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import axe from 'axe-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App, { PAGE_LOADING_LABEL } from '@/App'

const studentRoutes = ['/', '/recipes', '/recipes/pendulum', '/sensors', '/data-converter']
const themes = ['light', 'dark'] as const

beforeEach(() => {
  window.localStorage.clear()
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  Element.prototype.scrollIntoView = vi.fn()
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
        // 레시피 상세는 수식·마크다운·부품 그림을 함께 받아 와 기본 대기 시간
        // 1초를 넘길 때가 있습니다.
        await waitFor(
          () => expect(queryByText(PAGE_LOADING_LABEL)).not.toBeInTheDocument(),
          { timeout: 15000 },
        )

        const result = await axe.run(container, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
          },
          // jsdom does not calculate painted colors or element geometry.
          rules: {
            'color-contrast': { enabled: false },
          },
        })

        expect(
          result.violations,
          result.violations.map((violation) => `${violation.id}: ${violation.help}`).join('\n'),
        ).toEqual([])
      })
    }
  }
})
