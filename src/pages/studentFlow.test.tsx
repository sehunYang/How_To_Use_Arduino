// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { SearchResultsPage } from './SearchResultsPage'
import { RecipeDetailPage } from './recipe/RecipeDetailPage'
import { RecipeListPage } from './RecipeListPage'
import { progressKey } from '@/progress'
import { WiringIllustration } from '@/components/WiringIllustration'
import { pendulumRecipe } from '@/data/canary'

function renderAt(path: string, element: ReactNode, route = path.split('?')[0]) {
  window.history.replaceState({}, '', path)
  return render(<BrowserRouter><Routes><Route path={route} element={element} /></Routes></BrowserRouter>)
}

/**
 * 레시피 한 편이 다섯 단계로 갈라졌으므로 테스트도 단계를 골라 그립니다.
 * 껍데기가 자기 안에서 다시 Routes를 그리므로 바깥 경로는 `/*`로 열어 둡니다.
 */
function renderStep(step: string, element: ReactNode = <RecipeDetailPage />) {
  return renderAt(`/recipes/pendulum${step ? `/${step}` : ''}`, element, '/recipes/:id/*')
}

beforeEach(() => {
  window.localStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()
  // jsdom은 스크롤을 구현하지 않아 호출마다 경고를 냅니다. 실제 실패를 가립니다.
  window.scrollBy = vi.fn()
})
afterEach(cleanup)

describe('Phase 3 student flow', () => {
  /**
   * 카드가 알리는 한 줄은 이 탐구가 답하려는 질문입니다. 예전에 쓰던 응용 안내는
   * Phase 6의 41개가 글자까지 같아 갤러리에서 레시피를 구별할 수 없었습니다.
   */
  it('always shows three search results with the inquiry question and matched evidence', () => {
    renderAt('/search?q=진자', <SearchResultsPage />, '/search')
    expect(screen.getAllByRole('link', { name: /레시피 보기/ })).toHaveLength(3)
    expect(screen.getByText(/#진자/)).toBeInTheDocument()
    expect(screen.getByText('진자가 한 번 왕복하는 시간은 무엇이 정할까?')).toBeInTheDocument()
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
    renderStep('wiring')
    const checks = screen.getAllByRole('checkbox')
    await userEvent.click(checks[0])
    expect(screen.getByText('1/4 완료')).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(progressKey('pendulum')) ?? '{}').checked[0]).toBe(true)
    await userEvent.click(checks[0])
    expect(screen.getByText('0/4 완료')).toBeInTheDocument()
  })

  it('names exact breadboard holes in the wiring instructions', () => {
    renderStep('wiring')

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
    renderStep('code')

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
    renderStep('design')

    const step = guideStep(/책상 모서리에 스탠드를 고정하고/)
    expect(step).not.toBeChecked()
    fireEvent.click(step)
    expect(step).toBeChecked()

    expect(window.localStorage.getItem('arduino-checklist:v1:guide:pendulum'))
      .toContain('책상 모서리에 스탠드를 고정하고')

    cleanup()
    renderStep('design')
    expect(guideStep(/책상 모서리에 스탠드를 고정하고/)).toBeChecked()
  })

  it('numbers the guide steps so none looks skipped', () => {
    renderStep('design')

    // 순서 있는 목록이라 번호가 붙고, 각 항목이 체크 상자를 하나씩 가집니다.
    const list = screen.getByText(/책상 모서리에 스탠드를 고정하고/).closest('ol')
    expect(list).toBeInTheDocument()
    expect(list?.querySelectorAll('input[type="checkbox"]').length).toBeGreaterThanOrEqual(5)
  })

  it('sends the student from a part in the list to that sensor page', () => {
    renderStep('parts')

    expect(screen.getByRole('link', { name: /MPU6050 가속도·자이로 센서/ }))
      .toHaveAttribute('href', '/sensors/mpu6050')
  })

  // Ticking every box on the page one at a time takes ~3s of the 5s default,
  // so this test failed whenever the full suite loaded the machine. The wait
  // is the point of the test (the handoff only appears after the last box),
  // so the timeout goes up rather than the interaction being faked.
  it('shows the completion handoff after the final wiring step', async () => {
    renderStep('wiring')
    for (const checkbox of screen.getAllByRole('checkbox')) await userEvent.click(checkbox)
    expect(screen.getByText(/배선 완료 → 이제 코드를 실행할 차례/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '페이지 주소 복사' })).toBeInTheDocument()
  }, 30_000)

  it('renders a friendly withdrawn-recipe state without leaking an error', () => {
    renderAt('/recipes/withdrawn-recipe', <RecipeDetailPage />, '/recipes/:id/*')
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
      '/recipes/:id/*',
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
      '/recipes/:id/*',
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
    renderStep('wiring')

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
    renderStep('wiring')

    const check = screen.getByRole('region', { name: /USB를 꽂기 전에/ })
    const boxes = within(check).getAllByRole('checkbox')
    expect(boxes.length).toBeGreaterThan(0)
    expect(check).toHaveTextContent(`0/${boxes.length} 확인`)

    fireEvent.click(boxes[0])
    expect(boxes[0]).toBeChecked()
    expect(check).toHaveTextContent(`1/${boxes.length} 확인`)

    cleanup()
    renderStep('wiring')
    const reopened = screen.getByRole('region', { name: /USB를 꽂기 전에/ })
    expect(within(reopened).getAllByRole('checkbox')[0]).toBeChecked()
  })

  /**
   * 값이 나오기만 하면 측정이 되고 있다고 믿기 쉽습니다. 고장났을 때만 나오는
   * 값을 여기에서 걸러 내지 못하면 한 시간을 헛측정합니다.
   */
  it('says what a healthy first reading looks like, and which values mean broken wiring', () => {
    renderStep('code')

    const reading = screen.getByRole('region', { name: '처음 나온 값이 정상인지 확인하기' })
    expect(reading).toHaveTextContent(/평평한 책상에 두면/)
    expect(reading).toHaveTextContent('여섯 값이 모두 0입니다')
    // 센서와 상관없이 겪는 증상도 같은 표에 함께 둡니다.
    expect(reading).toHaveTextContent('알아볼 수 없는 기호만 나옵니다')
  })

  it('explains the sketch before showing it', () => {
    renderStep('code')

    const summary = screen.getByRole('heading', { name: '이 코드가 하는 일' }).closest('div')!
    expect(summary).toHaveTextContent('115200 baud')
    expect(summary).toHaveTextContent(/loop\(\)/)
  })

  /** 한 칸 밀려 꽂았을 때 스스로 되짚으려면 어떤 구멍이 이어져 있는지를 알아야 합니다. */
  it('folds the breadboard primer away but keeps it above the wiring steps', () => {
    renderStep('wiring')

    const primer = screen.getByText(/브레드보드가 처음이라면/)
    expect(primer.closest('details')).not.toHaveAttribute('open')
    expect(screen.getByRole('img', { name: /브레드보드 연결 그림/ })).toBeInTheDocument()
  })

  /**
   * 레시피에 들어와 처음 만나는 것은 무엇을 왜 재는 탐구인가입니다. 부품도 배선도
   * 아닙니다. 예전에는 이 표가 가이드 본문 첫머리에 있어 네 번째 절에 가서야
   * 나왔고, 그때는 이미 부품을 챙기고 배선을 마친 뒤였습니다.
   */
  it('opens on the question the inquiry answers, not on the parts', () => {
    renderStep('')

    expect(screen.getByRole('heading', { name: '한눈에 보기' })).toBeInTheDocument()
    expect(screen.getByText('이 탐구가 답하려는 질문')).toBeInTheDocument()
    // 부품은 이 화면에 없고, 골라서 들어가는 자리로만 있습니다.
    expect(screen.queryByRole('heading', { name: '1. 준비물 챙기기' })).toBeNull()
    expect(screen.getByRole('link', { name: '1. 준비물 챙기기' }))
      .toHaveAttribute('href', '/recipes/pendulum/parts')
  })

  /**
   * 단계마다 주소가 다르므로 이 줄은 화면 안에서 자리를 옮기는 것이 아니라 다른
   * 화면으로 가는 길입니다. 배선을 마친 학생이 코드만 다시 보려면 이 줄이 필요합니다.
   */
  it('offers a way to move between the steps', () => {
    renderStep('wiring')

    const nav = screen.getByRole('navigation', { name: '이 레시피의 단계' })
    expect(within(nav).getByRole('link', { name: '3. 코드' })).toHaveAttribute('href', '/recipes/pendulum/code')
    expect(within(nav).getByRole('link', { name: '4. 탐구 설계' })).toHaveAttribute('href', '/recipes/pendulum/design')
    // 지금 서 있는 단계는 링크가 아니라 표시입니다.
    expect(within(nav).getByText('2. 배선')).toHaveAttribute('aria-current', 'page')
  })

  /** 하던 일을 마친 학생이 다음으로 갈 자리는 화면 끝에 있어야 합니다. */
  it('points at the next step from the end of the current one', () => {
    renderStep('code')

    const nav = screen.getByRole('navigation', { name: '단계 이동' })
    expect(within(nav).getByRole('link', { name: /2\. 배선하기/ })).toHaveAttribute('href', '/recipes/pendulum/wiring')
    expect(within(nav).getByRole('link', { name: /4\. 탐구 설계/ })).toHaveAttribute('href', '/recipes/pendulum/design')
  })

  /**
   * 배선의 `MPU6050.SDA → UNO.A4`와 코드의 A4가 같은 것을 가리킨다는 사실은
   * 스케치의 `// @pin` 선언에 이미 있었지만 화면에 그리기 직전에 지워졌습니다.
   * 핀을 옮기려는 학생은 어디를 함께 고쳐야 하는지 알 수 없었습니다.
   */
  it('shows which wiring step each pin in the sketch belongs to', () => {
    renderStep('code')

    const map = screen.getByText(/배선과 코드가 이어지는 자리/).closest('details')!
    expect(map).not.toHaveAttribute('open')
    expect(map).toHaveTextContent('MPU6050.SDA')
    expect(map).toHaveTextContent('배선과 코드를 함께')
    // 배선은 이제 다른 화면이라, 같은 화면 안의 자리가 아니라 그 화면을 가리킵니다.
    expect(within(map).getByRole('link', { name: '3단계' })).toHaveAttribute('href', '/recipes/pendulum/wiring#step-3')
  })

  /** 값을 고친 뒤 업로드해야 한다는 사실이 없으면 학생은 코드를 잘못 고친 줄 압니다. */
  it('says the changed value only reaches the board after another upload', () => {
    renderStep('code')

    const note = screen.getByText(/업로드 단추를 다시 눌러야/).closest('p')!
    expect(note).toHaveTextContent('다시 눌러 원래 코드를 붙여 넣으세요')
  })

  /**
   * 같은 안전 문장을 배선 위와 가이드 안에서 두 번 보여 주던 것을 한 자리로
   * 모았습니다. 읽어야 할 자리는 꽂기 전입니다.
   */
  it('shows the safety notice once, before the wiring starts', () => {
    renderStep('wiring')

    expect(screen.getAllByText(/5V에 꽂으세요/)).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: /안전 점검/ })).toBeNull()
  })

  /** '응용해 보기'는 가이드의 '더 나아가기'와 같은 일을 했습니다. 사다리 쪽만 남깁니다. */
  it('keeps one place for what to try next', () => {
    renderStep('measure')

    expect(screen.queryByRole('heading', { name: '응용해 보기' })).toBeNull()
    expect(screen.getByText(/더 나아가기/)).toBeInTheDocument()
  })

  /**
   * 스케치·업로드·시리얼 모니터·baud·라이브러리는 코드 단계에서 처음 나오는 말인데
   * 사전은 배선 쪽에만 있었습니다. 되돌아가지 않는 학생은 뜻을 모른 채 지나갑니다.
   * 단계가 갈라진 뒤에는 각 화면이 자기 사전을 하나씩만 들고 있어야 합니다.
   */
  it('puts each term on the step where it first appears', () => {
    renderStep('wiring')
    const wiring = screen.getByText(/이 단계에 나오는 말의 뜻/).closest('details')!
    expect(wiring).toHaveTextContent('SDA')
    expect(wiring).not.toHaveTextContent('baud')

    cleanup()
    renderStep('code')
    const code = screen.getByText(/이 단계에 나오는 말의 뜻/).closest('details')!
    expect(code).toHaveTextContent('baud')
    expect(code).toHaveTextContent('시리얼 모니터')
    expect(code).not.toHaveTextContent('SDA')
  })

  it('fills the help card with what the screen already knows', () => {
    renderStep('')

    const card = screen.getByRole('heading', { name: /선생님께 보여 줄 카드/ }).closest('div')!
    expect(card).toHaveTextContent(`${pendulumRecipe.wiring.length}단계 중 0단계까지 확인함`)
    expect(card).toHaveTextContent('115200 baud')
    // 학생이 채울 자리를 지어내지 않습니다.
    expect(card).toHaveTextContent('무엇이 안 되나요:')
  })
})
