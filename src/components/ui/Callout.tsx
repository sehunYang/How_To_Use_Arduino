import type { ReactNode } from 'react'

const styles = {
  info: 'border-accent bg-muted-background',
  warn: 'border-warning bg-warning-background',
  tip: 'border-success bg-success-background',
  danger: 'border-danger bg-danger-background',
} as const

export function Callout({ type = 'info', children }: { type?: keyof typeof styles; children: ReactNode }) {
  return <aside className={`rounded-card border-l-4 p-4 ${styles[type]}`} role="note">{children}</aside>
}
