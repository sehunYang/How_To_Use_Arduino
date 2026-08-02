// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DataAnalysisPage } from './DataAnalysisPage'

const RUN_1 = 'time_ms,temperature_c,humidity_pct{enter}0,20,50{enter}1000,22,48{enter}2000,24,46'
const RUN_2 = 'time_ms,temperature_c,humidity_pct{enter}0,22,51{enter}1000,24,49{enter}2000,26,47'

type User = ReturnType<typeof userEvent.setup>

async function paste(user: User, text: string) {
  const textarea = screen.getByLabelText('시리얼 모니터 내용')
  await user.clear(textarea)
  await user.type(textarea, text)
  await user.click(screen.getByRole('button', { name: /데이터 분석하기|회차로 추가하기/ }))
}

describe('DataAnalysisPage', () => {
  let createObjectUrl: ReturnType<typeof vi.fn>
  let anchorClick: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    createObjectUrl = vi.fn(() => 'blob:serial-csv')
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  })

  afterEach(() => {
    anchorClick.mockRestore()
    cleanup()
  })

  it('reports the parsed shape and saves a BOM-prefixed CSV only when asked', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await paste(user, RUN_1)

    expect(screen.getByRole('status')).toHaveTextContent('1개 회차, 3개 열, 모두 3개 데이터 행')
    expect(createObjectUrl).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'CSV 파일로 저장' }))

    const blob = createObjectUrl.mock.calls[0][0] as Blob
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder().decode(bytes)).toBe(
      'time_ms,temperature_c,humidity_pct\r\n0,20,50\r\n1000,22,48\r\n2000,24,46',
    )
  })

  it('summarises every numeric column', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await paste(user, RUN_1)

    const summaryRow = screen.getByRole('row', { name: /^temperature_c/ })
    const cells = within(summaryRow).getAllByRole('cell').map((cell) => cell.textContent)
    // 개수 · 평균 · 표준편차 · 최솟값 … 최댓값 · 범위
    expect([cells[0], cells[1], cells[2], cells[3], cells[7], cells[8]]).toEqual(['3', '22', '2', '20', '24', '4'])
  })

  it('plots the first two numeric columns and lets the axes be changed', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await paste(user, RUN_1)

    expect(screen.getByRole('img')).toHaveAccessibleName(/가로축은 time_ms, 세로축은 temperature_c인 산점도/)
    expect(screen.getByText(/그림 1\. time_ms에 따른 temperature_c/)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('가로축(x) 변인'), 'temperature_c')

    // 세로축에 있던 변인을 가로축으로 옮겼으므로 두 축이 맞바뀝니다.
    expect(screen.queryByRole('checkbox', { name: /temperature_c/ })).not.toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAccessibleName(/가로축은 temperature_c, 세로축은 time_ms/)
  })

  it('fits a regression line and explains the relationship', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await paste(user, RUN_1)

    const relation = screen.getByRole('region', { name: '4. 두 변인의 관계' })
    expect(within(relation).getByText('y = 0.002x + 20')).toBeInTheDocument()
    // 온도가 시간에 정확히 비례하는 표본이라 상관계수와 R²가 모두 1입니다.
    expect(within(relation).getAllByText('1')).toHaveLength(2)
    expect(within(relation).getByText(/관계가 매우 뚜렷합니다/)).toBeInTheDocument()
  })

  it('switches the chart to a line and drops the trend line for several variables', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await paste(user, RUN_1)

    await user.click(screen.getByRole('radio', { name: '꺾은선' }))
    expect(screen.getByRole('img')).toHaveAccessibleName(/꺾은선 그래프/)

    await user.click(screen.getByRole('checkbox', { name: /humidity_pct/ }))
    expect(screen.getByRole('checkbox', { name: '회귀직선 함께 그리기' })).toBeDisabled()
    expect(screen.queryByRole('region', { name: '4. 두 변인의 관계' })).not.toBeInTheDocument()
  })

  it('does not analyse invalid input and reports the excluded line numbers', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await paste(user, 'time_ms,value{enter}0{enter}1000')

    expect(screen.getByRole('alert')).toHaveTextContent('저장할 수 있는 데이터 행이 없습니다')
    expect(screen.getByText('제외된 행: 2, 3')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('clears the pasted text and every derived view', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await paste(user, RUN_1)

    await user.click(screen.getByRole('button', { name: '전체 지우기' }))

    expect(screen.getByLabelText('시리얼 모니터 내용')).toHaveValue('')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  /**
   * 붙여넣은 회차는 이 화면 안에만 있고 어디에도 저장되지 않습니다. 실수로 지웠을 때
   * 되돌릴 수 없다면 실험을 여러 번 되풀이해 모은 값이 그대로 사라집니다.
   */
  it('takes the clearing back so a mistaken click does not cost the measurements', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await paste(user, RUN_1)

    await user.click(screen.getByRole('button', { name: '전체 지우기' }))
    await user.click(screen.getByRole('button', { name: '되돌리기' }))

    expect(screen.getByRole('status')).toHaveTextContent('1개 회차')
    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '되돌리기' })).not.toBeInTheDocument()
  })

  /**
   * 이 묶음은 회차를 여러 번 붙여넣고 그때마다 그래프를 다시 그립니다. 한 건에 3~5초가
   * 걸려 기본 제한 5초에 아슬아슬하게 걸쳐 있었고, 전체 테스트를 한꺼번에 돌려 기계가
   * 바쁠 때마다 무작위로 끊겼습니다. 느린 것이지 잘못된 것이 아니므로 시간을 넉넉히 줍니다.
   */
  describe('반복 실험', { timeout: 30_000 }, () => {
    it('empties the box after each run so the next one can be pasted straight in', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)

      expect(screen.getByLabelText('시리얼 모니터 내용')).toHaveValue('')
      expect(screen.getByRole('button', { name: '2회차로 추가하기' })).toBeDisabled()
    })

    it('draws the runs as a box plot at each measurement position', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)
      await paste(user, RUN_2)

      expect(screen.getByRole('status')).toHaveTextContent('2개 회차, 3개 열, 모두 6개 데이터 행')
      expect(screen.getByRole('img')).toHaveAccessibleName(/2개 회차의 값을 측정 순번마다 상자그림으로 그렸습니다/)
      expect(screen.getByText(/상자는 제1사분위수부터 제3사분위수까지이고/)).toBeInTheDocument()
      expect(screen.getByText(/측정 순번 3개 중 3개에서 두 회차 이상 측정되어 상자를 그릴 수 있습니다/)).toBeInTheDocument()

      // 회차별 행이 측정값마다 함께 실립니다.
      const summary = screen.getByRole('region', { name: '2. 측정값 요약' })
      expect(within(summary).getAllByRole('row', { name: /^1회차/ })).toHaveLength(3)
      expect(within(summary).getAllByRole('row', { name: /^2회차/ })).toHaveLength(3)
    })

    it('draws one series per run when asked to compare them', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)
      await paste(user, RUN_2)

      await user.click(screen.getByRole('radio', { name: /회차별로 나누어 보기/ }))

      expect(screen.getByRole('img')).toHaveAccessibleName(/계열은 1회차, 2회차입니다/)
      const relation = screen.getByRole('region', { name: '4. 두 변인의 관계' })
      const perTrial = within(relation).getByRole('row', { name: /^1회차/ })
      expect(within(perTrial).getAllByRole('cell')[1]).toHaveTextContent('0.002')
      expect(within(relation).getByText(/회차별 기울기의 평균은 0.002이고, 표준편차는 0입니다/)).toBeInTheDocument()
    })

    it('adds a trial column to the CSV so the runs stay apart', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)
      await paste(user, RUN_2)

      await user.click(screen.getByRole('button', { name: 'CSV 파일로 저장' }))
      const blob = createObjectUrl.mock.calls[0][0] as Blob
      const text = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()))

      // TextDecoder는 앞머리 BOM을 떼고 읽으므로 여기서는 열 이름부터 비교합니다.
      expect(text).toBe(
        '회차,time_ms,temperature_c,humidity_pct\r\n'
        + '1회차,0,20,50\r\n1회차,1000,22,48\r\n1회차,2000,24,46\r\n'
        + '2회차,0,22,51\r\n2회차,1000,24,49\r\n2회차,2000,26,47',
      )
    })

    it('refuses a run whose columns do not match the first one', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)
      await paste(user, 'time_ms,lux{enter}0,300{enter}1000,320')

      expect(screen.getByRole('alert')).toHaveTextContent('빠진 열: temperature_c, humidity_pct')
      expect(screen.getByRole('alert')).toHaveTextContent('처음 보는 열: lux')
      expect(screen.getByRole('status')).toHaveTextContent('1개 회차')
    })

    it('renumbers the remaining runs when one is taken out', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)
      await paste(user, RUN_2)

      await user.click(screen.getByRole('button', { name: '1회차 빼기' }))

      expect(screen.getByRole('status')).toHaveTextContent('1개 회차')
      expect(screen.getByRole('button', { name: '2회차로 추가하기' })).toBeInTheDocument()
    })
  })
})
