// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DataConverterPage } from './DataConverterPage'

describe('DataConverterPage', () => {
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

  it('downloads a BOM-prefixed CSV and shows conversion counts', async () => {
    const user = userEvent.setup()
    render(<DataConverterPage />)

    await user.type(screen.getByLabelText('시리얼 모니터 내용'), 'time_ms,value{enter}0,21.5{enter}1000,21.7')
    await user.click(screen.getByRole('button', { name: '변환하여 CSV 저장' }))

    expect(screen.getByRole('status')).toHaveTextContent('2개 열, 2개 데이터 행')
    expect(createObjectUrl).toHaveBeenCalledOnce()
    const blob = createObjectUrl.mock.calls[0][0] as Blob
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder().decode(bytes)).toBe('time_ms,value\r\n0,21.5\r\n1000,21.7')
    expect(anchorClick).toHaveBeenCalledOnce()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:serial-csv')
  })

  it('does not download invalid input and reports excluded line numbers', async () => {
    const user = userEvent.setup()
    render(<DataConverterPage />)

    await user.type(screen.getByLabelText('시리얼 모니터 내용'), 'time_ms,value{enter}0{enter}1000')
    await user.click(screen.getByRole('button', { name: '변환하여 CSV 저장' }))

    expect(screen.getByRole('alert')).toHaveTextContent('저장할 수 있는 데이터 행이 없습니다')
    expect(screen.getByText('제외된 행: 2, 3')).toBeInTheDocument()
    expect(createObjectUrl).not.toHaveBeenCalled()
  })

  it('clears the pasted text and result', async () => {
    const user = userEvent.setup()
    render(<DataConverterPage />)
    const textarea = screen.getByLabelText('시리얼 모니터 내용')

    await user.type(textarea, 'time,value{enter}0,1')
    await user.click(screen.getByRole('button', { name: '변환하여 CSV 저장' }))
    await user.click(screen.getByRole('button', { name: '초기화' }))

    expect(textarea).toHaveValue('')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
