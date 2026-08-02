// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

  /**
   * 두 번째 레시피부터는 설치 안내가 이미 아는 내용입니다. 늘 펼쳐 두면 코드가
   * 화면 밖으로 밀려나므로, 무엇이 들었는지 알 만한 요약만 남기고 접어 둡니다.
   */
  it('folds the setup guidance away but says what is inside', () => {
    renderAt('/recipes/pendulum', <RecipeDetailPage />, '/recipes/:id')

    const firstRun = screen.getByText(/아두이노가 처음이라면/)
    expect(firstRun.closest('details')).not.toHaveAttribute('open')
    // 요약 줄만 읽고도 무엇을 설치해야 하는지 알 수 있어야 열지 말지 고릅니다.
    // 문제 해결 항목도 "필요한 라이브러리"를 가리키므로 요약 줄만 집어냅니다.
    const libraries = screen.getByText(/^필요한 라이브러리 \d+개/)
    expect(libraries).toHaveTextContent('MPU6050')
    expect(libraries.closest('details')).not.toHaveAttribute('open')
    // 속도는 접지 않습니다. 틀리면 깨진 기호만 나오고 단서가 없습니다.
    expect(screen.getByText(/시리얼 모니터 속도 115200 baud/)).toBeInTheDocument()
  })

  /**
   * 예전 가이드의 상자는 `□` 글자였습니다. 눌러도 아무 일이 없어 학생에게는
   * 고장으로 보였습니다. 진짜로 눌리고, 다시 열어도 남아 있어야 합니다.
   */
  /**
   * 이 화면에서는 접근성 이름으로 찾지 않고 `userEvent`도 쓰지 않습니다. KaTeX
   * 스타일시트가 실린 뒤 jsdom의 `getComputedStyle`이 터지는데, 접근성 이름 계산과
   * user-event의 pointer-events 검사가 모두 그것을 지나갑니다. user-event는 그때
   * 클릭을 조용히 흘려 버려, 상자는 눌린 것처럼 보이지만 핸들러는 돌지 않습니다.
   * 글자로 찾고 `fireEvent`로 눌러 그 함정을 피합니다.
   */
  function guideStep(text: RegExp) {
    return screen.getByText(text).closest('li')!.querySelector('input[type="checkbox"]')!
  }

  it('lets the student tick a guide step and remembers it', async () => {
    renderAt('/recipes/pendulum', <RecipeDetailPage />, '/recipes/:id')

    const step = guideStep(/책상 모서리에 스탠드를 고정하고/)
    expect(step).not.toBeChecked()
    fireEvent.click(step)
    expect(step).toBeChecked()

    expect(window.localStorage.getItem('arduino-checklist:v1:guide:pendulum'))
      .toContain('책상 모서리에 스탠드를 고정하고')

    cleanup()
    renderAt('/recipes/pendulum', <RecipeDetailPage />, '/recipes/:id')
    expect(guideStep(/책상 모서리에 스탠드를 고정하고/)).toBeChecked()
  })

  it('numbers the guide steps so none looks skipped', () => {
    renderAt('/recipes/pendulum', <RecipeDetailPage />, '/recipes/:id')

    // 순서 있는 목록이라 번호가 붙고, 각 항목이 체크 상자를 하나씩 가집니다.
    const list = screen.getByText(/책상 모서리에 스탠드를 고정하고/).closest('ol')
    expect(list).toBeInTheDocument()
    expect(list?.querySelectorAll('input[type="checkbox"]').length).toBeGreaterThanOrEqual(5)
  })

  it('sends the student from a part in the list to that sensor page', () => {
    renderAt('/recipes/pendulum', <RecipeDetailPage />, '/recipes/:id')

    expect(screen.getByRole('link', { name: /MPU6050 가속도·자이로 센서/ }))
      .toHaveAttribute('href', '/sensors/mpu6050')
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

/**
 * 아두이노도 배선도 코딩도 처음인 학생이 **화면 밖에서** 멈추던 자리들입니다.
 * 부품을 손에 들었을 때, 전원을 넣기 직전, 첫 숫자를 봤을 때가 그 자리입니다.
 */
describe('처음인 학생이 멈추던 자리', () => {
  /**
   * 체크 상자는 "꽂았는가"만 묻습니다. VCC와 GND를 바꿔 꽂은 학생도 모든 칸에
   * 표시를 하고 넘어가므로, 전원을 넣기 전에 한 번 더 묻는 자리가 필요합니다.
   */
  it('asks what to re-check before the USB goes in, drawn from the wiring itself', () => {
    renderAt('/recipes/pendulum', <RecipeDetailPage />, '/recipes/:id')

    const check = screen.getByRole('region', { name: /USB를 꽂기 전에/ })
    // 점검 문항의 끝점은 이 레시피의 실제 배선에서 온 것입니다.
    expect(check).toHaveTextContent('MPU6050.VCC')
    expect(check).toHaveTextContent('MPU6050.GND')
    expect(check).toHaveTextContent(/탄 냄새/)
  })

  /**
   * 읽기만 하는 글이면 어디까지 봤는지 표시할 자리가 없어, 중간에 끊기면 처음부터
   * 다시 읽어야 합니다. 배선 단계와 마찬가지로 눌리고 남아 있어야 합니다.
   */
  it('lets the student tick each pre-power check and remembers it', () => {
    renderAt('/recipes/pendulum', <RecipeDetailPage />, '/recipes/:id')

    const check = screen.getByRole('region', { name: /USB를 꽂기 전에/ })
    const boxes = within(check).getAllByRole('checkbox')
    expect(boxes.length).toBeGreaterThan(0)
    expect(check).toHaveTextContent(`0/${boxes.length} 확인`)

    fireEvent.click(boxes[0])
    expect(boxes[0]).toBeChecked()
    expect(check).toHaveTextContent(`1/${boxes.length} 확인`)

    cleanup()
    renderAt('/recipes/pendulum', <RecipeDetailPage />, '/recipes/:id')
    const reopened = screen.getByRole('region', { name: /USB를 꽂기 전에/ })
    expect(within(reopened).getAllByRole('checkbox')[0]).toBeChecked()
  })

  /**
   * 값이 나오기만 하면 측정이 되고 있다고 믿기 쉽습니다. 고장났을 때만 나오는
   * 값을 여기에서 걸러 내지 못하면 한 시간을 헛측정합니다.
   */
  it('says what a healthy first reading looks like, and which values mean broken wiring', () => {
    renderAt('/recipes/pendulum', <RecipeDetailPage />, '/recipes/:id')

    const reading = screen.getByRole('region', { name: '처음 나온 값이 정상인지 확인하기' })
    expect(reading).toHaveTextContent(/평평한 책상에 두면/)
    expect(reading).toHaveTextContent('여섯 값이 모두 0입니다')
    // 센서와 상관없이 겪는 증상도 같은 표에 함께 둡니다.
    expect(reading).toHaveTextContent('알아볼 수 없는 기호만 나옵니다')
  })

  it('explains the sketch before showing it', () => {
    renderAt('/recipes/pendulum', <RecipeDetailPage />, '/recipes/:id')

    const summary = screen.getByRole('heading', { name: '이 코드가 하는 일' }).closest('div')!
    expect(summary).toHaveTextContent('115200 baud')
    expect(summary).toHaveTextContent(/loop\(\)/)
  })

  /** 한 칸 밀려 꽂았을 때 스스로 되짚으려면 어떤 구멍이 이어져 있는지를 알아야 합니다. */
  it('folds the breadboard primer away but keeps it above the wiring steps', () => {
    renderAt('/recipes/pendulum', <RecipeDetailPage />, '/recipes/:id')

    const primer = screen.getByText(/브레드보드가 처음이라면/)
    expect(primer.closest('details')).not.toHaveAttribute('open')
    expect(screen.getByRole('img', { name: /브레드보드 연결 그림/ })).toBeInTheDocument()
  })

  it('fills the help card with what the screen already knows', () => {
    renderAt('/recipes/pendulum', <RecipeDetailPage />, '/recipes/:id')

    const card = screen.getByRole('heading', { name: /선생님께 보여 줄 카드/ }).closest('div')!
    expect(card).toHaveTextContent(`${pendulumRecipe.wiring.length}단계 중 0단계까지 확인함`)
    expect(card).toHaveTextContent('115200 baud')
    // 학생이 채울 자리를 지어내지 않습니다.
    expect(card).toHaveTextContent('무엇이 안 되나요:')
  })
})
