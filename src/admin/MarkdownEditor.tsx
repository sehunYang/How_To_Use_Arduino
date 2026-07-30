import { useRef } from 'react'
import { SafeMarkdown } from '@/components/ui/SafeMarkdown'
import { Button } from '@/components/ui/button'
import { Textarea } from './AdminFields'

const blocks = [
  { label: '제목', before: '## ', after: '' },
  { label: '코드', before: '```\n', after: '\n```' },
  { label: '강조 상자', before: ':::callout tip\n', after: '\n:::' },
  { label: '접기', before: ':::toggle 자세히 보기\n', after: '\n:::' },
  { label: '체크리스트', before: '- [ ] ', after: '' },
]

export function MarkdownEditor({
  value,
  onChange,
  error,
}: {
  value: string
  onChange(value: string): void
  error?: string
}) {
  const textarea = useRef<HTMLTextAreaElement>(null)

  function insert(before: string, after: string) {
    const start = textarea.current?.selectionStart ?? value.length
    const end = textarea.current?.selectionEnd ?? start
    const next = `${value.slice(0, start)}${before}${value.slice(start, end)}${after}${value.slice(end)}`
    onChange(next)
    requestAnimationFrame(() => {
      textarea.current?.focus()
      textarea.current?.setSelectionRange(start + before.length, end + before.length)
    })
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap gap-2" role="toolbar" aria-label="마크다운 블록 삽입">
          {blocks.map((block) => (
            <Button key={block.label} variant="outline" size="sm" onClick={() => insert(block.before, block.after)}>
              {block.label}
            </Button>
          ))}
        </div>
        <Textarea
          ref={textarea}
          aria-label="레시피 본문 마크다운"
          aria-invalid={Boolean(error)}
          value={value}
          rows={18}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono"
        />
        {error && <p className="mt-1 text-caption text-danger" role="alert">{error}</p>}
      </div>
      <div className="min-w-0 rounded-card border border-border bg-muted-background p-4">
        <h3 className="mb-3 font-semibold">실시간 미리보기</h3>
        <div className="prose min-w-0 overflow-wrap-anywhere">
          <SafeMarkdown source={value || '*본문을 입력하면 미리보기가 표시됩니다.*'} />
        </div>
      </div>
    </div>
  )
}
