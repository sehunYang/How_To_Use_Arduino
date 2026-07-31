import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeSanitize from 'rehype-sanitize'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { Callout } from './Callout'
import { Toggle } from './Toggle'

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

function Markdown({ source }: { source: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeSanitize, rehypeKatex]}
      components={{
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

export function SafeMarkdown({ source }: { source: string }) {
  return (
    <div className="space-y-4">
      {parseBlocks(source).map((block, index) => {
        if (block.kind === 'callout') return <Callout key={index} type={block.type}><Markdown source={block.source} /></Callout>
        if (block.kind === 'toggle') return <Toggle key={index} label={block.title}><Markdown source={block.source} /></Toggle>
        return <Markdown key={index} source={block.source} />
      })}
    </div>
  )
}
