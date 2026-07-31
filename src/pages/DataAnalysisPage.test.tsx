// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DataAnalysisPage } from './DataAnalysisPage'

const SAMPLE = 'time_ms,temperature_c,humidity_pct{enter}0,20,50{enter}1000,22,48{enter}2000,24,46'

async function pasteSample(user: ReturnType<typeof userEvent.setup>, text = SAMPLE) {
  await user.type(screen.getByLabelText('시리얼 모니터 내용'), text)
  await user.click(screen.getByRole('button', { name: '데이터 분석하기' }))
}

describe('DataAnalysisPage', () => {
  let createObjectUrl: ReturnType<typeof vi.fn>
  let revokeObjectUrl: ReturnType<typeof vi.fn>
  let anchorClick: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    createObjectUrl = vi.fn(() => 'blob:serial-csv')
    revokeObjectUrl = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl })
    anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  })

  afterEach(() => {
    anchorClick.mockRestore()
    cleanup()
  })

  it('reports the parsed shape and saves a BOM-prefixed CSV only when asked', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await pasteSample(user)

    expect(screen.getByRole('status')).toHaveTextContent('3개 열, 3개 데이터 행')
    expect(createObjectUrl).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'CSV 파일로 저장' }))

    const blob = createObjectUrl.mock.calls[0][0] as Blob
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder().decode(bytes)).toBe(
      'time_ms,temperature_c,humidity_pct\r\n0,20,50\r\n1000,22,48\r\n2000,24,46',
    )
    expect(anchorClick).toHaveBeenCalledOnce()
  })

  it('summarises every numeric column', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await pasteSample(user)

    const summaryRow = screen.getByRole('row', { name: /^temperature_c/ })
    const cells = within(summaryRow).getAllByRole('cell').map((cell) => cell.textContent)
    // 개수 · 평균 · 표준편차 · 최솟값 … 최댓값 · 범위
    expect(cells[0]).toBe('3')
    expect(cells[1]).toBe('22')
    expect(cells[2]).toBe('2')
    expect(cells[3]).toBe('20')
    expect(cells[7]).toBe('24')
    expect(cells[8]).toBe('4')
  })

  it('plots the first two numeric columns and lets the axes be changed', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await pasteSample(user)

    expect(screen.getByRole('img')).toHaveAccessibleName(
      /가로축은 time_ms, 세로축은 temperature_c인 산점도/,
    )
    expect(screen.getByText(/그림 1\. time_ms에 따른 temperature_c/)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('가로축(x) 변인'), 'temperature_c')

    // 가로축으로 옮긴 변인은 세로축 선택에서 사라지고, 그래프도 비워집니다.
    expect(screen.queryByRole('checkbox', { name: /temperature_c/ })).not.toBeInTheDocument()
    expect(screen.getByText('세로축 변인을 하나 이상 고르면 그래프가 그려집니다.')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /humidity_pct/ }))
    expect(screen.getByRole('img')).toHaveAccessibleName(/가로축은 temperature_c, 세로축은 humidity_pct/)
  })

  it('fits a regression line and explains the relationship', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await pasteSample(user)

    const relation = screen.getByRole('region', { name: '4. 두 변인의 관계' })
    expect(within(relation).getByText('y = 0.002x + 20')).toBeInTheDocument()
    // 온도가 시간에 정확히 비례하는 표본이라 상관계수와 R²가 모두 1입니다.
    expect(within(relation).getAllByText('1')).toHaveLength(2)
    expect(within(relation).getByText(/관계가 매우 뚜렷합니다/)).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAccessibleName(/산점도/)
  })

  it('switches the chart to a line and drops the trend line for several series', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await pasteSample(user)

    await user.click(screen.getByRole('radio', { name: '꺾은선' }))
    expect(screen.getByRole('img')).toHaveAccessibleName(/꺾은선 그래프/)

    await user.click(screen.getByRole('checkbox', { name: /humidity_pct/ }))
    expect(screen.getByRole('checkbox', { name: '회귀직선 함께 그리기' })).toBeDisabled()
    expect(screen.queryByRole('region', { name: '4. 두 변인의 관계' })).not.toBeInTheDocument()
  })

  it('does not analyse invalid input and reports the excluded line numbers', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await pasteSample(user, 'time_ms,value{enter}0{enter}1000')

    expect(screen.getByRole('alert')).toHaveTextContent('저장할 수 있는 데이터 행이 없습니다')
    expect(screen.getByText('제외된 행: 2, 3')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('clears the pasted text and every derived view', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await pasteSample(user)

    await user.click(screen.getByRole('button', { name: '초기화' }))

    expect(screen.getByLabelText('시리얼 모니터 내용')).toHaveValue('')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
