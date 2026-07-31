import { useState } from 'react'
import { Button } from './button'
import { highlightArduinoLine } from './arduinoSyntax'
import { parseDisplayCode } from './codeManifest'
import { formatArduinoCode } from '@/lib/formatArduinoCode'

interface Tunable {
  anchor: string
  name: string
  hint: string
}

export function CodeBlock({ code, tunables = [] }: { code: string; tunables?: Tunable[] }) {
  const [copied, setCopied] = useState(false)
  const lines = parseDisplayCode(formatArduinoCode(code))
  const displayCode = lines.map((line) => line.text).join('\n')

  async function copy() {
    await navigator.clipboard.writeText(displayCode)
    setCopied(true)
  }

  return (
    <div className="min-w-0 bg-muted-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-caption text-muted">Arduino sketch</span>
        <Button size="sm" variant="outline" onClick={() => void copy()}>{copied ? '복사됨' : '코드 복사'}</Button>
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
            표시 줄 {Math.max(1, lines.findIndex((line) => line.tunableAnchor === tunable.anchor || line.text.includes(tunable.anchor)) + 1)}의
            {' '}{tunable.anchor} 값을 바꾸세요. {tunable.hint}
          </p>
        </aside>
      ))}
      <span className="sr-only" aria-live="polite">{copied ? '코드가 클립보드에 복사되었습니다.' : ''}</span>
    </div>
  )
}
