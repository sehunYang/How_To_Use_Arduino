import { useEffect, useRef, useState } from 'react'
import { Button } from './button'
import { highlightArduinoLine } from './arduinoSyntax'
import { parseDisplayCode } from './codeManifest'
import { formatArduinoCode } from '@/lib/formatArduinoCode'

interface Tunable {
  anchor: string
  name: string
  hint: string
}

/** 복사했다는 표시를 되돌리기까지 기다리는 시간. */
const COPIED_RESET_MS = 2000

export function CodeBlock({ code, tunables = [] }: { code: string; tunables?: Tunable[] }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lines = parseDisplayCode(formatArduinoCode(code))
  const displayCode = lines.map((line) => line.text).join('\n')

  useEffect(() => () => clearTimeout(resetTimer.current), [])

  /**
   * 복사 결과는 잠깐 보여 주고 원래 이름으로 되돌립니다. `복사됨`을 그대로 두면 코드를
   * 고쳐 다시 복사할 때 눌렸는지 알 수 없고, 클립보드를 막아 둔 브라우저에서는 아무 일도
   * 일어나지 않은 것처럼 보입니다. 그래서 실패도 화면에 적어 직접 골라 복사하도록 안내합니다.
   */
  async function copy() {
    clearTimeout(resetTimer.current)
    try {
      await navigator.clipboard.writeText(displayCode)
      setState('copied')
    } catch {
      setState('failed')
    }
    resetTimer.current = setTimeout(() => setState('idle'), COPIED_RESET_MS)
  }

  const label = state === 'copied' ? '복사됨' : state === 'failed' ? '복사 실패' : '코드 복사'

  return (
    <div className="min-w-0 bg-muted-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-caption text-muted">Arduino sketch</span>
        <Button size="sm" variant="outline" onClick={() => void copy()}>{label}</Button>
      </div>
      <pre className="max-w-full overflow-x-auto p-4 text-caption">
        <code>
          {lines.map((line, index) => {
            const tunable = tunables.find((item) => item.anchor === line.tunableAnchor || line.text.includes(item.anchor))
            return (
              <span
                key={`${index}-${line.text}`}
                className={`grid grid-cols-[3ch_minmax(0,1fr)] border-l-4 pl-3 ${tunable ? 'border-warning bg-warning-background' : 'border-transparent'}`}
                title={tunable?.hint}
              >
                <span aria-hidden="true" className="select-none text-muted">{index + 1}</span>
                <span>{line.text ? highlightArduinoLine(line.text) : ' '}{'\n'}</span>
              </span>
            )
          })}
        </code>
      </pre>
      {tunables.map((tunable) => (
        <aside key={tunable.anchor} className="border-t border-border bg-warning-background p-4">
          <strong className="text-warning">바꿔볼 값: {tunable.name}</strong>
          <p className="mt-1 text-caption">
            {Math.max(1, lines.findIndex((line) => line.tunableAnchor === tunable.anchor || line.text.includes(tunable.anchor)) + 1)}번 줄{' '}
            <code>{tunable.anchor}</code> · {tunable.hint}
          </p>
        </aside>
      ))}
      {/* 실패 안내는 눈에 보이는 문장 하나로 두고, 그 자체를 낭독하게 합니다. 화면용 문장과
          낭독용 문장을 따로 두면 같은 말을 두 번 읽습니다. */}
      {state === 'failed' && (
        <p role="alert" className="border-t border-border bg-danger-background p-4 text-caption text-danger">
          이 브라우저에서는 복사 단추를 쓸 수 없습니다. 위 코드를 직접 선택해 복사하세요.
        </p>
      )}
      <span className="sr-only" aria-live="polite">{state === 'copied' ? '코드가 클립보드에 복사되었습니다.' : ''}</span>
    </div>
  )
}
