// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CodeBlock } from './CodeBlock'
import { SafeMarkdown } from './SafeMarkdown'

describe('student content components', () => {
  afterEach(cleanup)
  it('removes every manifest line from display and clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<CodeBlock code={'// @pin SDA=A4\n// @baud 9600\n// @tunable delayMs\nint delayMs=10;'} />)
    expect(screen.queryByText(/@pin|@baud|@tunable/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '코드 복사' }))
    expect(writeText).toHaveBeenCalledWith('int delayMs=10;')
  })

  it('sanitizes executable HTML and unsafe links', () => {
    render(<SafeMarkdown source={'<script>alert(1)</script>\n<img src=x onerror=alert(2)>\n\n[위험](javascript:alert(3))\n\n**안전한 내용**'} />)
    expect(document.querySelector('script, img, a[href^="javascript:"]')).toBeNull()
    expect(screen.getByText('안전한 내용')).toBeTruthy()
  })

  it('renders the allowed callout and toggle blocks', () => {
    render(<SafeMarkdown source={':::callout warn\n주의 내용\n:::\n\n:::toggle 더 보기\n숨은 내용\n:::'} />)
    expect(screen.getByRole('note')).toHaveTextContent('주의 내용')
    expect(screen.getByText('더 보기')).toBeTruthy()
  })
})
