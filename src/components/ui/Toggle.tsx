import { type ReactNode } from 'react'

export function Toggle({
  label,
  children,
  defaultOpen = false,
}: {
  label: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details className="rounded-card border border-border p-4" open={defaultOpen}>
      <summary className="cursor-pointer font-semibold">{label}</summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}
