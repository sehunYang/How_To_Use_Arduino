import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const controlClass = 'w-full rounded-card border border-border bg-background px-3 py-2 text-foreground'

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="block font-medium">{label}</span>
      {children}
      {hint && <span className="block text-caption text-muted">{hint}</span>}
      {error && <span className="block text-caption text-danger" role="alert">{error}</span>}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${controlClass} ${props.className ?? ''}`} />
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => <textarea {...props} ref={ref} className={`${controlClass} ${props.className ?? ''}`} />,
)
Textarea.displayName = 'Textarea'

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-background p-4">
      <h2 className="mb-4 text-heading font-semibold">{title}</h2>
      {children}
    </section>
  )
}
