import type { ReactNode } from 'react'

/**
 * 레시피 단계 화면이 함께 쓰는 모양.
 *
 * 탐구 설계와 측정은 가이드 마크다운을 `SafeMarkdown`으로, 나머지 단계는 React로
 * 직접 그립니다. 두 길이 절 제목·단계 번호·표를 따로 그리면 화면마다 결이 달라져,
 * 학생은 같은 것을 볼 때마다 새로 읽는 법을 익혀야 했습니다. 모양은 여기 한 곳에만
 * 둡니다.
 */

/** 절 번호(4-1)나 짧은 이름(요약)을 담는 둥근 표. */
export const sectionBadgeClass =
  'inline-flex shrink-0 items-center rounded-full bg-accent px-2.5 py-0.5 text-caption font-semibold text-background'

/** 단계 화면 안의 절 제목. 위 구분선과 번호 표로 지금 몇 번째 절인지 보이게 합니다. */
export function SectionHeading({ id, badge, children }: { id?: string; badge?: string; children: ReactNode }) {
  return (
    <h3 id={id} className="mt-10 flex max-w-3xl items-center gap-3 border-t border-border pt-6 text-xl font-bold text-foreground">
      {/* 번호는 눈으로 훑을 때의 표지라, 화면 낭독기에는 제목만 읽힙니다. */}
      {badge && <span aria-hidden="true" className={sectionBadgeClass}>{badge}</span>}
      <span>{children}</span>
    </h3>
  )
}

/** 순서대로 할 일의 번호. 체크 상자 옆에 붙습니다. */
export const stepBadgeClass =
  'inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-caption font-semibold text-background'

export function StepBadge({ children }: { children: ReactNode }) {
  return <span aria-hidden="true" className={`mt-0.5 ${stepBadgeClass}`}>{children}</span>
}

/** 표. 가로로 넘치면 표만 밀어 볼 수 있게 감쌉니다. */
export const tableWrapClass = 'my-5 overflow-x-auto rounded-card border border-border'
export const tableClass = 'm-0 w-full border-collapse text-sm'
export const thClass = 'border-b border-border bg-surface-strong px-3 py-2 text-left font-semibold'
export const tdClass = 'border-b border-border px-3 py-2 align-top tabular-nums'

/**
 * `widths`를 주면 열 너비를 고정합니다. 같은 모양의 표가 한 화면에 여럿 이어질 때
 * 칸 위치가 표마다 달라지지 않게 합니다.
 */
export function GuideTable({ caption, head, widths, children }: {
  caption: string
  head: ReactNode[]
  widths?: string[]
  children: ReactNode
}) {
  return (
    <div className={tableWrapClass}>
      <table className={`${tableClass}${widths ? ' min-w-xl table-fixed' : ''}`}>
        <caption className="sr-only">{caption}</caption>
        {widths && <colgroup>{widths.map((width, index) => <col key={index} style={{ width }} />)}</colgroup>}
        <thead>
          <tr>{head.map((cell, index) => <th key={index} scope="col" className={thClass}>{cell}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

/** 이름을 단 안내 상자. 탐구 설계의 "이 탐구가 확인하려는 것" 상자와 같은 모양입니다. */
const boxStyles = {
  info: 'border-accent bg-muted-background',
  tip: 'border-success bg-success-background',
  warn: 'border-warning bg-warning-background',
} as const

export function LabelledBox({ label, tone = 'info', children }: { label: string; tone?: keyof typeof boxStyles; children: ReactNode }) {
  return (
    <aside role="note" className={`my-4 rounded-card border-l-4 p-4 ${boxStyles[tone]}`}>
      <strong className={tone === 'warn' ? 'text-warning' : undefined}>{label}</strong>{' '}
      {children}
    </aside>
  )
}
