import { useCallback, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeSanitize from 'rehype-sanitize'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { Callout } from './Callout'
import { Toggle } from './Toggle'
import { loadChecklist, saveChecklist, type ChecklistState } from '@/progress'

type CalloutType = 'info' | 'warn' | 'tip' | 'danger'
type Block =
  | { kind: 'markdown'; source: string }
  | { kind: 'callout'; type: CalloutType; source: string }
  | { kind: 'toggle'; title: string; source: string }

function parseBlocks(source: string): Block[] {
  const lines = source.split('\n')
  const blocks: Block[] = []
  let markdown: string[] = []
  const flush = () => {
    if (markdown.length) blocks.push({ kind: 'markdown', source: markdown.join('\n') })
    markdown = []
  }
  for (let index = 0; index < lines.length; index += 1) {
    const directive = lines[index].match(/^:::(callout|toggle)(?:\s+(.+))?\s*$/)
    if (!directive) {
      markdown.push(lines[index])
      continue
    }
    flush()
    const content: string[] = []
    index += 1
    while (index < lines.length && lines[index].trim() !== ':::') {
      content.push(lines[index])
      index += 1
    }
    if (directive[1] === 'callout') {
      const requested = directive[2]?.trim()
      const type: CalloutType = requested === 'warn' || requested === 'danger' || requested === 'tip' ? requested : 'info'
      blocks.push({ kind: 'callout', type, source: content.join('\n') })
    } else {
      blocks.push({ kind: 'toggle', title: directive[2]?.trim() || '더 보기', source: content.join('\n') })
    }
  }
  flush()
  return blocks
}

/** hast 노드에서 사람이 읽는 글자만 이어 붙입니다. 체크 상태의 열쇠로 씁니다. */
function nodeText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const element = node as { type?: string; value?: string; children?: unknown[] }
  if (element.type === 'text') return element.value ?? ''
  return (element.children ?? []).map(nodeText).join('')
}

interface ChecklistBinding {
  isChecked: (item: string) => boolean
  toggle: (item: string, checked: boolean) => void
}

function Markdown({ source, checklist }: { source: string; checklist?: ChecklistBinding }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeSanitize, rehypeKatex]}
      components={{
        /**
         * GFM은 `- [ ]`을 **비활성** 체크 상자로 그립니다. 눌러도 아무 일이
         * 없는 상자는 학생에게 고장으로 보입니다. 우리가 직접 그린 상자로
         * 바꿔 실제로 눌리고 다시 와도 남아 있게 합니다.
         */
        input: (props) =>
          checklist && props.type === 'checkbox'
            ? null
            : <input {...props} />,
        li: ({ children, className, node, ...props }) => {
          const isTask = typeof className === 'string' && className.includes('task-list-item')
          if (!checklist || !isTask) return <li {...props} className={className}>{children}</li>
          const item = nodeText(node).trim()
          const checked = checklist.isChecked(item)
          return (
            <li {...props} className="my-1 list-none">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-accent"
                  checked={checked}
                  onChange={(event) => checklist.toggle(item, event.target.checked)}
                />
                <span className={checked ? 'text-muted line-through' : undefined}>{children}</span>
              </label>
            </li>
          )
        },
        a: ({ children, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>,
        h2: ({ children, ...props }) => (
          <h2 {...props} className="mt-10 border-l-4 border-accent pl-4 text-2xl font-bold tracking-tight text-foreground">{children}</h2>
        ),
        h3: ({ children, ...props }) => (
          <h3 {...props} className="mt-8 text-xl font-bold text-foreground">{children}</h3>
        ),
        table: ({ children, ...props }) => (
          <div className="my-5 overflow-x-auto rounded-card border border-border">
            <table {...props} className="m-0 min-w-2xl border-collapse text-sm">{children}</table>
          </div>
        ),
        th: ({ children, ...props }) => <th {...props} className="border-b border-border bg-surface-strong px-3 py-2 text-left font-semibold">{children}</th>,
        td: ({ children, ...props }) => <td {...props} className="border-b border-border px-3 py-2 align-top tabular-nums">{children}</td>,
      }}
    >
      {source}
    </ReactMarkdown>
  )
}

/**
 * `checklistScope`를 주면 이 본문의 `- [ ]` 항목이 실제로 눌리고, 브라우저에
 * 남아 다음에 열어도 그대로입니다. 주지 않으면 예전처럼 읽기 전용입니다 —
 * 관리자 미리보기처럼 진행도를 남길 자리가 없는 곳에서 그렇습니다.
 */
export function SafeMarkdown({ source, checklistScope }: { source: string; checklistScope?: string }) {
  const [state, setState] = useState<ChecklistState>({})

  useEffect(() => {
    if (!checklistScope) return
    setState(loadChecklist(checklistScope, typeof window === 'undefined' ? undefined : window.localStorage))
  }, [checklistScope])

  const toggle = useCallback((item: string, checked: boolean) => {
    if (!checklistScope) return
    setState((previous) => {
      const next = { ...previous }
      if (checked) next[item] = true
      else delete next[item]
      saveChecklist(checklistScope, next, typeof window === 'undefined' ? undefined : window.localStorage)
      return next
    })
  }, [checklistScope])

  const checklist = checklistScope
    ? { isChecked: (item: string) => state[item] === true, toggle }
    : undefined

  return (
    <div className="space-y-4">
      {parseBlocks(source).map((block, index) => {
        if (block.kind === 'callout') return <Callout key={index} type={block.type}><Markdown source={block.source} checklist={checklist} /></Callout>
        if (block.kind === 'toggle') return <Toggle key={index} label={block.title}><Markdown source={block.source} checklist={checklist} /></Toggle>
        return <Markdown key={index} source={block.source} checklist={checklist} />
      })}
    </div>
  )
}
