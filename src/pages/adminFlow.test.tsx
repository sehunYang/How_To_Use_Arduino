// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { pendulumRecipe } from '@/data/canary/pendulum'
import type { AdminAuthState, AdminServices } from '@/admin/AdminServices'
import { AdminPage } from './AdminPage'

afterEach(cleanup)

function services(auth: AdminAuthState, overrides: Partial<AdminServices> = {}): AdminServices {
  return {
    getAuthState: () => auth,
    subscribeAuth: () => () => undefined,
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    loadDashboardStats: vi.fn(async () => ({ rows: [], failedTokens: [] })),
    listRecipes: vi.fn(async () => []),
    getRecipe: vi.fn(async () => null),
    saveRecipe: vi.fn(async (recipe) => recipe),
    publishRecipe: vi.fn(async (recipe) => ({ ...recipe, status: 'published' })),
    checkPublishReadiness: vi.fn(async () => ({ canPublish: false, issues: [] })),
    requestVerification: vi.fn(async () => undefined),
    listRecipeVersions: vi.fn(async () => []),
    restoreRecipeVersion: vi.fn(async () => pendulumRecipe),
    rebuildSearchIndex: vi.fn(async () => undefined),
    uploadImage: vi.fn(async () => ({ url: '/image.png', width: 800, height: 600 })),
    getInventory: vi.fn(async () => ({ sensors: [], actuators: [] })),
    registerSensor: vi.fn(async () => undefined),
    getRationales: vi.fn(async () => []),
    saveRationales: vi.fn(async () => undefined),
    ...overrides,
  }
}

function renderAdmin(path: string, adminServices: AdminServices) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/*" element={<AdminPage services={adminServices} />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('관리자 UI', () => {
  it.each([
    [{ status: 'loading' } as AdminAuthState, '관리자 권한을 확인하는 중…'],
    [{ status: 'access-denied', email: 'blocked@example.com' } as AdminAuthState, '접근 권한 없음'],
    [{ status: 'admin', email: 'admin@example.com' } as AdminAuthState, '관리자 작업 공간'],
  ])('인증 상태 %o 화면을 표시한다', async (auth, expectedText) => {
    renderAdmin('/admin', services(auth))
    expect(await screen.findByText(expectedText)).toBeInTheDocument()
  })

  it('이메일과 비밀번호를 로그인 서비스에 전달한다', async () => {
    const adminServices = services({ status: 'signed-out' })
    const user = userEvent.setup()
    renderAdmin('/admin', adminServices)

    await user.type(screen.getByLabelText('이메일'), 'teacher@example.com')
    await user.type(screen.getByLabelText('비밀번호'), 'secret-password')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(adminServices.signIn).toHaveBeenCalledWith('teacher@example.com', 'secret-password')
  })

  it('레시피별 시작, 완료, 단계별 중도 이탈 통계를 표시한다', async () => {
    const adminServices = services(
      { status: 'admin', email: 'admin@example.com' },
      {
        loadDashboardStats: vi.fn(async () => ({
          failedTokens: [],
          rows: [{
            recipeId: 'pendulum',
            title: '진자 실험',
            stats: { started: 20, completed: 12, dropAtStep: { '1': 3, '3': 2 }, processedThrough: null },
          }],
        })),
      },
    )
    renderAdmin('/admin', adminServices)

    expect(await screen.findByText('진자 실험')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('2단계: 3명')).toBeInTheDocument()
    expect(screen.getByText('4단계: 2명')).toBeInTheDocument()
  })

  it('저장 서비스의 필드 오류를 중첩 입력란 아래에 표시한다', async () => {
    const serviceError = Object.assign(new Error('입력값을 확인하세요.'), {
      fieldErrors: {
        title: '같은 제목의 레시피가 있습니다.',
        'wiring.0.from': '등록된 핀을 선택하세요.',
      },
    })
    const adminServices = services(
      { status: 'admin', email: 'admin@example.com' },
      {
        getRecipe: vi.fn(async () => pendulumRecipe),
        saveRecipe: vi.fn(async () => { throw serviceError }),
      },
    )
    const user = userEvent.setup()
    renderAdmin('/admin/recipes/pendulum', adminServices)

    await screen.findByDisplayValue(pendulumRecipe.title)
    await user.click(screen.getByRole('button', { name: '임시 저장' }))

    await waitFor(() => {
      expect(screen.getByText('같은 제목의 레시피가 있습니다.')).toBeInTheDocument()
      expect(screen.getByText('등록된 핀을 선택하세요.')).toBeInTheDocument()
    })
  })

  it('마크다운 블록 버튼으로 본문에 안전한 블록 문법을 삽입한다', async () => {
    const adminServices = services(
      { status: 'admin', email: 'admin@example.com' },
      { getRecipe: vi.fn(async () => pendulumRecipe) },
    )
    const user = userEvent.setup()
    renderAdmin('/admin/recipes/pendulum', adminServices)

    const editor = await screen.findByLabelText('레시피 본문 마크다운')
    await user.click(screen.getByRole('button', { name: '강조 상자' }))

    expect((editor as HTMLTextAreaElement).value).toContain(':::callout tip')
    await user.click(screen.getByRole('button', { name: '체크리스트' }))
    expect((editor as HTMLTextAreaElement).value).toContain('- [ ] ')
  })

  it('현재 버전의 검증 조건을 통과하기 전에는 공개 버튼을 비활성화한다', async () => {
    const adminServices = services(
      { status: 'admin', email: 'admin@example.com' },
      {
        getRecipe: vi.fn(async () => pendulumRecipe),
        checkPublishReadiness: vi.fn(async () => ({ canPublish: true, issues: [] })),
      },
    )
    const user = userEvent.setup()
    renderAdmin('/admin/recipes/pendulum', adminServices)

    const publish = await screen.findByRole('button', { name: '공개' })
    expect(publish).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '공개 조건 확인' }))
    await waitFor(() => expect(publish).toBeEnabled())
  })
})
