// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
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

  /**
   * 예전에는 `복사됨`이 한 번 뜨면 그대로 굳었습니다. 코드를 고쳐 다시 복사할 때
   * 눌렸는지 알 길이 없었습니다.
   */
  it('returns the copy button to its name so the next copy still gives an answer', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    render(<CodeBlock code={'int a=1;'} />)

    await userEvent.click(screen.getByRole('button', { name: '코드 복사' }))
    expect(screen.getByRole('button', { name: '복사됨' })).toBeInTheDocument()

    await waitFor(
      () => expect(screen.getByRole('button', { name: '코드 복사' })).toBeInTheDocument(),
      { timeout: 4000 },
    )
  }, 10_000)

  /** 클립보드를 막아 둔 브라우저에서 아무 일도 없던 것처럼 보이면 안 됩니다. */
  it('says so and offers a way out when the browser refuses the clipboard', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    render(<CodeBlock code={'int a=1;'} />)

    await userEvent.click(screen.getByRole('button', { name: '코드 복사' }))

    expect(screen.getByRole('button', { name: '복사 실패' })).toBeInTheDocument()
    expect(screen.getByText(/직접 선택해 복사하세요/)).toBeInTheDocument()
  })

  it('syntax-highlights Arduino code without changing its text', () => {
    render(<CodeBlock code={'int value = 10;\nvoid setup() { digitalWrite(13, HIGH); }\n// ready'} />)

    expect(screen.getByText('int')).toHaveClass('text-syntax-type')
    expect(screen.getByText('void')).toHaveClass('text-syntax-type')
    expect(screen.getByText('digitalWrite')).toHaveClass('text-syntax-function')
    expect(screen.getByText('HIGH')).toHaveClass('text-syntax-number')
    expect(screen.getByText('// ready')).toHaveClass('text-syntax-comment')
  })

  it('formats compact Arduino code for both display and clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<CodeBlock code={'void loop(){for(byte ch=0;ch<8;ch++){Serial.println(ch);}}'} />)
    expect(screen.getByText('for')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '코드 복사' }))
    expect(writeText).toHaveBeenCalledWith(
      'void loop() {\n  for(byte ch=0;ch<8;ch++) {\n    Serial.println(ch);\n  }\n}',
    )
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

  it('renders LaTeX equations and aligned GFM tables', () => {
    const { container } = render(
      <SafeMarkdown source={'| 조건 | 값 |\n|:---|---:|\n| 1 | 3.14 |\n\n$$\\bar{x}=\\frac{1}{n}\\sum x_i$$'} />,
    )
    expect(screen.getByRole('table')).toHaveClass('min-w-2xl')
    expect(screen.getByText('3.14')).toHaveClass('tabular-nums')
    expect(container.querySelector('.katex')).not.toBeNull()
    expect(container.querySelector('math')).not.toBeNull()
  })

  it('visually separates inquiry guide section headings', () => {
    render(<SafeMarkdown source={'## 탐구 목표\n\n내용\n\n### 준비 단계\n\n설명'} />)
    expect(screen.getByRole('heading', { name: '탐구 목표' })).toHaveClass('text-2xl', 'font-bold', 'border-accent')
    expect(screen.getByRole('heading', { name: '준비 단계' })).toHaveClass('text-xl', 'font-bold')
  })
})
