// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { RecipeDetailPage } from './RecipeDetailPage'
import { RecipeListPage } from './RecipeListPage'

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
})

afterEach(cleanup)

describe('Phase 3 responsive layout contracts', () => {
  it.each([360, 768, 1920])('keeps the main content shrinkable at %ipx', (width) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    const { container } = render(
      <MemoryRouter>
        <AppShell><div data-testid="wide-child" className="w-full">content</div></AppShell>
      </MemoryRouter>,
    )

    expect(container.querySelector('main')).toHaveClass('min-w-0')
    expect(container.querySelector('.app-layout')).toBeInTheDocument()
  })

  it('contains intentionally wide recipe tables in a horizontal scroller', async () => {
    render(<MemoryRouter><RecipeListPage /></MemoryRouter>)
    screen.getByRole('button', { name: '테이블' }).click()

    const table = await screen.findByRole('table')
    expect(table.parentElement).toHaveClass('overflow-x-auto')
  })

  it('keeps both recipe columns shrinkable and the wiring controls inside the viewport', () => {
    Element.prototype.scrollIntoView = () => undefined
    const { container } = render(
      <MemoryRouter initialEntries={['/recipes/pendulum']}>
        <Routes>
          <Route path="/recipes/:id" element={<RecipeDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(container.querySelector('[data-testid="wiring-layout"]')).toHaveClass('min-w-0')
    expect(container.querySelector('[data-testid="wiring-layout"]')).not.toHaveClass('lg:grid-cols-2')
    expect(container.querySelector('[data-testid="wiring-steps"]')).toHaveClass('min-w-0')
    expect(screen.getByTestId('wiring-viewport').parentElement?.parentElement).toHaveClass(
      'sticky',
      'top-16',
      'lg:top-20',
    )
    const endpoint = container.querySelector('[data-wiring-endpoint="MPU6050.VCC"]')
    expect(endpoint?.querySelector('.text-syntax-type')).toHaveTextContent('MPU6050')
    expect(endpoint?.querySelector('.text-syntax-property')).toHaveTextContent('VCC')
    expect(screen.getByTestId('wiring-viewport')).toHaveClass(
      'aspect-[2/3]',
      'lg:aspect-[16/9]',
      'touch-none',
    )
    expect(screen.getByText(/휠·핀치로 최대 500% 확대/)).toHaveClass(
      'text-micro',
      'leading-tight',
    )
  })
})
