// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RouteErrorBoundary, isStaleChunkError } from './RouteErrorBoundary'

function Boom({ message }: { message: string }): never {
  throw new Error(message)
}

/** 배포로 파일 이름이 바뀌었을 때 브라우저가 실제로 내는 메시지 */
const STALE = 'Failed to fetch dynamically imported module: https://example.test/assets/SearchResultsPage-Do83c2tj.js'

function renderBoundary(children: React.ReactNode, reload = vi.fn(), now = () => 1_000_000, resetKey = '/search') {
  const view = render(
    <MemoryRouter>
      <RouteErrorBoundary resetKey={resetKey} reload={reload} now={now}>{children}</RouteErrorBoundary>
    </MemoryRouter>,
  )
  return { ...view, reload }
}

describe('RouteErrorBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // React는 경계가 잡은 오류도 콘솔에 남깁니다. 테스트 출력만 조용히 합니다.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    window.sessionStorage.clear()
  })

  afterEach(() => {
    consoleError.mockRestore()
    cleanup()
  })

  it.each([
    'Failed to fetch dynamically imported module: /assets/x.js',
    'error loading dynamically imported module',
    'Importing a module script failed.',
    'ChunkLoadError: Loading chunk 3 failed',
  ])('recognises %s as a stale build', (message) => {
    expect(isStaleChunkError(new Error(message))).toBe(true)
  })

  it('does not mistake an ordinary render error for a stale build', () => {
    expect(isStaleChunkError(new Error('Cannot read properties of undefined'))).toBe(false)
  })

  it('renders its children while nothing is wrong', () => {
    renderBoundary(<p>레시피 목록</p>)

    expect(screen.getByText('레시피 목록')).toBeInTheDocument()
  })

  it('reloads once when the build changed under an open tab', () => {
    const { reload } = renderBoundary(<Boom message={STALE} />)

    expect(reload).toHaveBeenCalledOnce()
    expect(screen.getByRole('alert')).toHaveTextContent('안내서가 방금 새로 올라가서')
  })

  it('does not reload again while the first attempt is still recent', () => {
    const reload = vi.fn()
    renderBoundary(<Boom message={STALE} />, reload, () => 1_000_000)
    cleanup()
    renderBoundary(<Boom message={STALE} />, reload, () => 1_000_000 + 5_000)

    expect(reload).toHaveBeenCalledOnce()
  })

  it('reloads again once the cooldown has passed', () => {
    const reload = vi.fn()
    renderBoundary(<Boom message={STALE} />, reload, () => 1_000_000)
    cleanup()
    renderBoundary(<Boom message={STALE} />, reload, () => 1_000_000 + 40_000)

    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('explains an ordinary render error without reloading behind the student', () => {
    const { reload } = renderBoundary(<Boom message="sensor is not defined" />)

    expect(reload).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('화면을 그리는 중에 문제가 생겼어요')
  })

  it('offers a way back that keeps the rest of the site reachable', async () => {
    const { reload } = renderBoundary(<Boom message="sensor is not defined" />)

    expect(screen.getByRole('link', { name: '처음으로' })).toHaveAttribute('href', '/')
    await userEvent.click(screen.getByRole('button', { name: '새로 고침' }))
    expect(reload).toHaveBeenCalledOnce()
  })

  it('clears the error when the student moves to another page', () => {
    const reload = vi.fn()
    const { rerender } = render(
      <MemoryRouter>
        <RouteErrorBoundary resetKey="/search" reload={reload}><Boom message="sensor is not defined" /></RouteErrorBoundary>
      </MemoryRouter>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <RouteErrorBoundary resetKey="/recipes" reload={reload}><p>레시피 목록</p></RouteErrorBoundary>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('레시피 목록')).toBeInTheDocument()
  })
})
