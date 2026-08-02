// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { SearchResultsPage } from './SearchResultsPage'
import { RecipeDetailPage } from './RecipeDetailPage'
import { RecipeListPage } from './RecipeListPage'
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
  // jsdom은 스크롤을 구현하지 않아 호출마다 경고를 냅니다. 실제 실패를 가립니다.
  window.scrollBy = vi.fn()
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

  /**
   * 검색은 딱 맞는 게 없으면 비슷해 보이는 것을 대신 내놓습니다. 그 사실을 말해 주지 않으면
   * 학생은 화면에 뜬 레시피가 자기가 적은 탐구의 답이라고 믿게 됩니다.
   */
  it('says how many recipes matched, and how many are only near misses', () => {
    renderAt('/search?q=zzzqqqxyz', <SearchResultsPage />, '/search')

    expect(screen.getByText(/딱 맞는 레시피는 찾지 못해/)).toBeInTheDocument()
    // 맞는 센서가 없을 때 제목만 남고 아래가 텅 빈 자리를 두지 않습니다.
    expect(screen.queryByRole('heading', { name: '필요한 센서' })).not.toBeInTheDocument()
  })

  it('counts the recipes it actually matched', () => {
    renderAt('/search?q=진자', <SearchResultsPage />, '/search')

    expect(screen.getByText(/레시피 1개를 찾았습니다/)).toBeInTheDocument()
  })

  /** 조건을 좁혀 아무것도 남지 않으면 개수만 적힌 빈 자리가 아니라 빠져나갈 길을 줍니다. */
  it('offers a way out when the recipe filters leave nothing', async () => {
    renderAt('/recipes', <RecipeListPage />)

    await userEvent.selectOptions(screen.getByLabelText('과목'), '생물')

    expect(screen.getByText('0개의 레시피')).toBeInTheDocument()
    expect(screen.getByText('고른 조건에 맞는 레시피가 없습니다.')).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: '필터 지우기' })[0])
    expect(screen.queryByText('0개의 레시피')).not.toBeInTheDocument()
  })

  /** 센서 고르개의 값은 저장용 id라 학생이 부품에서 읽는 이름과 달랐습니다. */
  it('names sensors in the filter the way the parts are labelled', () => {
    renderAt('/recipes', <RecipeListPage />)

    const options = Array.from(screen.getByLabelText('센서').querySelectorAll('option'), (option) => option.textContent)
    expect(options).toContain('MPU6050')
    expect(options).not.toContain('mpu6050')
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
