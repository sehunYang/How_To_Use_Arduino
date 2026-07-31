// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { SearchResultsPage } from './SearchResultsPage'
import { RecipeDetailPage } from './RecipeDetailPage'
import { progressKey } from '@/progress'
import { WiringIllustration } from '@/components/WiringIllustration'
import { pendulumRecipe } from '@/data/canary'

function renderAt(path: string, element: ReactNode, route = path.split('?')[0]) {
  window.history.replaceState({}, '', path)
  return render(<BrowserRouter><Routes><Route path={route} element={element} /></Routes></BrowserRouter>)
}

beforeEach(() => {
  window.localStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(cleanup)

describe('Phase 3 student flow', () => {
  it('always shows three search results with application guidance and matched evidence', () => {
    renderAt('/search?q=진자', <SearchResultsPage />, '/search')
    expect(screen.getAllByRole('link', { name: /레시피 보기/ })).toHaveLength(3)
    expect(screen.getByText(/#진자/)).toBeInTheDocument()
    expect(screen.getByText(/진자의 길이를 바꿔가며/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /센서 자세히 보기/ }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('추천 이유').length).toBeGreaterThan(0)
  })

  it('advances wiring focus, persists progress, and reverses on uncheck', async () => {
    renderAt('/recipes/pendulum', <RecipeDetailPage />, '/recipes/:id')
    const checks = screen.getAllByRole('checkbox')
    await userEvent.click(checks[0])
    expect(screen.getByText('1/4 완료')).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(progressKey('pendulum')) ?? '{}').checked[0]).toBe(true)
    await userEvent.click(checks[0])
    expect(screen.getByText('0/4 완료')).toBeInTheDocument()
  })

  it('names exact breadboard holes in the wiring instructions', () => {
    renderAt('/recipes/pendulum', <RecipeDetailPage />, '/recipes/:id')

    expect(screen.getByText('MPU6050.VCC → BB.tp.5')).toBeInTheDocument()
    expect(screen.getByText('UNO.5V → BB.tp.1')).toBeInTheDocument()
    expect(screen.getByText('MPU6050.GND → BB.tn.5')).toBeInTheDocument()
    expect(screen.getByText('UNO.GND → BB.tn.1')).toBeInTheDocument()
    expect(screen.getByText('MPU6050.SDA → UNO.A4')).toBeInTheDocument()
  })

  it('shows the completion handoff after the final wiring step', async () => {
    renderAt('/recipes/pendulum', <RecipeDetailPage />, '/recipes/:id')
    for (const checkbox of screen.getAllByRole('checkbox')) await userEvent.click(checkbox)
    expect(screen.getByText(/배선 완료 → 이제 코드를 실행할 차례/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '페이지 주소 복사' })).toBeInTheDocument()
  })

  it('renders a friendly withdrawn-recipe state without leaking an error', () => {
    renderAt('/recipes/withdrawn-recipe', <RecipeDetailPage />, '/recipes/:id')
    expect(screen.getByRole('heading', { name: '이 레시피는 현재 볼 수 없어요' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '검색으로 돌아가기' })).toBeInTheDocument()
  })

  it.each([
    ['static SVG', '/How_To_Use_Arduino/wiring/circuit.svg'],
    ['Firebase Storage URL', 'https://firebasestorage.googleapis.com/v0/b/example/o/wiring%2Fcircuit.svg?alt=media'],
  ])('renders the same validated vector circuit for a %s source', (_, imageUrl) => {
    const { container } = render(
      <WiringIllustration recipe={{ ...pendulumRecipe, imageUrl }} activeStep={0} />,
    )
    expect(screen.getByRole('img', { name: /1단계까지 연결됨/ })).toBeTruthy()
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('viewBox')
    expect(svg?.querySelectorAll('[data-part-id]').length).toBeGreaterThan(0)
    expect(svg?.querySelectorAll('[data-wire-id]')).toHaveLength(2)
  })

  it('renders a draft only after an authenticated admin preview check', async () => {
    const draft = { ...pendulumRecipe, id: 'draft-preview', status: 'draft' as const }
    renderAt(
      '/recipes/draft-preview?preview=1',
      <RecipeDetailPage previewServices={{ authorize: async () => true, loadRecipe: async () => draft }} />,
      '/recipes/:id',
    )
    expect(await screen.findByText('관리자 미리보기 · 학생 화면과 동일한 레이아웃')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: draft.title })).toBeInTheDocument()
  })

  it('fails closed when preview authorization rejects', async () => {
    renderAt(
      '/recipes/draft-preview?preview=1',
      <RecipeDetailPage previewServices={{
        authorize: async () => { throw new Error('auth unavailable') },
        loadRecipe: async () => null,
      }} />,
      '/recipes/:id',
    )
    expect(await screen.findByRole('heading', { name: '이 레시피는 현재 볼 수 없어요' })).toBeInTheDocument()
  })
})
