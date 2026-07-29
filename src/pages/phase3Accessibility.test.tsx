// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import axe from 'axe-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App'

const studentRoutes = ['/', '/recipes', '/recipes/pendulum', '/sensors']
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
        const { container } = render(<App />)

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
