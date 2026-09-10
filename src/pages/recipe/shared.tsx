import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ResistorBands } from '@/components/ResistorBands'
import { Button } from '@/components/ui/button'
import { loadChecklist, saveChecklist, type ChecklistState } from '@/progress'
import { helpCardText } from '@/recipes/classroom'
import type { GlossaryEntry } from '@/recipes/glossary'
import { shortComponentLabel, type PartLine } from '@/recipes/parts'
import type { PinLine } from '@/recipes/pinMap'
import type { PowerCheck } from '@/recipes/powerCheck'
import type { Recipe } from '@/schema'

export function EndpointLabel({ value }: { value: string }) {
  const separator = value.indexOf('.')
  const component = separator === -1 ? value : value.slice(0, separator)
  const pin = separator === -1 ? '' : value.slice(separator + 1)
  return (
    <span data-wiring-endpoint={value}>
      <span className="text-syntax-type">{shortComponentLabel(component)}</span>
      {pin && <><span className="text-syntax-operator">.</span><span className="text-syntax-property">{pin}</span></>}
    </span>
  )
}

const WIRING_TEXT_TOKEN = /\b(?:[A-Z][A-Z0-9_-]*|[AD]\d+|\d+(?:\.\d+)?\s?(?:kΩ|Ω|V|mA))\b/g
const PIN_NAMES = new Set(['VCC', 'VIN', 'GND', 'SCL', 'SDA', 'AO', 'OUT', 'DATA', 'DQ', 'SIG'])
export const WIRE_COLOR_CLASS: Record<string, string> = {
  red: 'text-wire-red',
  black: 'text-wire-black',
  blue: 'text-wire-blue',
  green: 'text-wire-green',
  orange: 'text-wire-orange',
  purple: 'text-wire-purple',
  white: 'text-wire-white',
  yellow: 'text-wire-yellow',
}

export function HighlightedWiringText({ text }: { text: string }) {
  const fragments = []
  let cursor = 0
  for (const match of text.matchAll(WIRING_TEXT_TOKEN)) {
    if (match.index > cursor) fragments.push(text.slice(cursor, match.index))
    const token = match[0]
    const className = /\d/.test(token)
      ? 'text-syntax-number'
      : PIN_NAMES.has(token)
        ? 'text-syntax-property'
        : 'text-syntax-type'
    fragments.push(<span key={`${match.index}-${token}`} className={className}>{token}</span>)
    cursor = match.index + token.length
  }
  if (cursor < text.length) fragments.push(text.slice(cursor))
  return fragments
}

/**
 * 전원을 넣기 직전에 하나씩 짚어 보는 목록.
 *
 * 배선 단계의 체크 상자는 "꽂았는가"만 묻습니다. 맞게 꽂았는지는 여기에서 다시
 * 봅니다. 읽기만 하는 글로 두었더니 배선 단계와 달리 어디까지 봤는지 표시할
 * 자리가 없어, 중간에 끊기면 처음부터 다시 읽어야 했습니다. 그래서 탐구 가이드의
 * 체크 목록과 같은 방식으로 눌리고 브라우저에 남게 합니다.
 */
export function PowerCheckList({ checks, recipeId }: { checks: PowerCheck[]; recipeId: string }) {
  const scope = `power:${recipeId}`
  const [checked, setChecked] = useState<ChecklistState>({})

  useEffect(() => {
    setChecked(loadChecklist(scope, typeof window === 'undefined' ? undefined : window.localStorage))
  }, [scope])

  function toggle(question: string, value: boolean) {
    setChecked((previous) => {
      const next = { ...previous }
      if (value) next[question] = true
      else delete next[question]
      saveChecklist(scope, next, typeof window === 'undefined' ? undefined : window.localStorage)
      return next
    })
  }

  const done = checks.filter((check) => checked[check.question]).length

  return (
    <section
      aria-labelledby="power-check-title"
      className="mt-6 max-w-3xl rounded-card border border-warning bg-warning-background p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="power-check-title" className="font-semibold text-warning">
          USB를 꽂기 전에 마지막으로 점검할 {checks.length}가지
        </h3>
        <span className="text-caption text-warning">{done}/{checks.length} 확인</span>
      </div>
      <ul className="mt-3 space-y-3">
        {checks.map((check) => (
          <li key={check.question}>
            <label className="flex min-h-11 cursor-pointer items-start gap-3">
              <input
                className="mt-1 size-5 accent-accent"
                type="checkbox"
                checked={checked[check.question] ?? false}
                onChange={(event) => toggle(check.question, event.target.checked)}
              />
              <span>
                <strong>{check.question}</strong>
                <span className="mt-1 block text-caption">{check.detail}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * 위 목록에서 답을 찾지 못했을 때 물어보러 가는 자리.
 *
 * "안 돼요"라는 말만으로는 선생님도 처음부터 다시 짚어야 합니다. 화면이 이미
 * 아는 것(레시피, 속도, 어디까지 했는지)을 채워 두면 그만큼을 건너뜁니다.
 * 빈칸은 학생이 채워야 하는 것이라 지어내지 않고 그대로 둡니다.
 */
export function HelpCard({ recipe, checkedSteps }: { recipe: Recipe; checkedSteps: number }) {
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')
  const text = helpCardText({ recipe, checkedSteps })

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied('copied')
    } catch {
      setCopied('failed')
    }
  }

  return (
    <div className="mt-6 rounded-card border border-border p-5">
      <h3 className="font-semibold">그래도 안 되면 선생님께 보여 줄 카드</h3>
      <p className="mt-2 text-caption text-muted">
        아래 내용을 복사해 빈칸만 채워 보여 주세요.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-card bg-muted-background p-4 text-caption">{text}</pre>
      <Button className="mt-3" variant="outline" onClick={() => void copy()}>
        {copied === 'copied' ? '복사됨' : copied === 'failed' ? '복사 실패' : '카드 복사'}
      </Button>
      <span className="sr-only" aria-live="polite">{copied === 'copied' ? '도움 요청 카드가 복사되었습니다.' : ''}</span>
      {copied === 'failed' && (
        <p className="mt-2 text-caption">이 브라우저에서는 복사할 수 없습니다. 위 내용을 직접 옮겨 적으세요.</p>
      )}
    </div>
  )
}

/** 그 단계에서 처음 나오는 말만 모아 접어 두는 사전. 두 단계가 같은 모양을 씁니다. */
export function GlossaryList({ title, entries }: { title: string; entries: GlossaryEntry[] }) {
  if (!entries.length) return null
  return (
    <details className="mt-4 max-w-3xl rounded-card border border-border p-4">
      <summary className="cursor-pointer font-semibold">
        {title}: {entries.map((entry) => entry.term).join(' · ')}
      </summary>
      <dl className="mt-3 space-y-2">
        {entries.map((entry) => (
          <div key={entry.term}>
            <dt className="inline font-semibold">{entry.term}</dt>
            <dd className="ml-2 inline text-caption text-muted">{entry.meaning}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

/**
 * 배선 한 줄과 코드 한 줄이 같은 핀을 가리킨다는 사실을 보여 주는 표.
 *
 * 이 대응은 스케치의 `// @pin` 선언에 이미 적혀 있고 빌드가 배선과 교차검증까지
 * 하지만, 화면은 그 줄을 지우고 그렸습니다(`parseDisplayCode`). 그래서 핀을 다른
 * 자리로 옮기고 싶은 학생은 배선과 코드 가운데 어디를 몇 군데 고쳐야 하는지
 * 알 수 없었습니다. 따라 하기만 하는 학생에게는 필요 없는 표이므로 접어 두되,
 * 요약 줄만 읽고도 안에 무엇이 있는지 알 수 있게 합니다.
 *
 * 배선 단계로 가는 링크가 같은 화면 안의 `#step-3`이 아니라 배선 화면의 주소인
 * 것은, 두 단계가 이제 서로 다른 화면이기 때문입니다.
 */
export function PinMap({ lines, recipeId }: { lines: PinLine[]; recipeId: string }) {
  if (!lines.length) return null
  return (
    <details className="mt-4 max-w-3xl rounded-card border border-border p-4">
      <summary className="cursor-pointer font-semibold">
        배선과 코드가 이어지는 자리 {lines.length}곳: 핀을 옮기려면 어디를 함께 고쳐야 하나
      </summary>
      <table className="mt-3 w-full text-left">
        <caption className="sr-only">배선 단계와 스케치의 핀 선언이 짝지어지는 표</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="py-2 pr-4 font-semibold">배선 단계</th>
            <th scope="col" className="py-2 pr-4 font-semibold">보드 핀</th>
            <th scope="col" className="py-2 pr-4 font-semibold">이어지는 곳</th>
            <th scope="col" className="py-2 font-semibold">코드가 부르는 이름</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.pin} className="border-b border-border align-top">
              <td className="py-2 pr-4">
                {line.step === null
                  ? <span className="text-muted">배선에 없음</span>
                  : <Link className="text-accent hover:underline" to={`/recipes/${recipeId}/wiring#step-${line.step}`}>{line.step}단계</Link>}
              </td>
              <td className="py-2 pr-4"><code>{line.pin}</code></td>
              <td className="py-2 pr-4 text-muted">{line.endpoint ?? '-'}</td>
              <td className="py-2">{line.role ? <code>{line.role}</code> : <span className="text-muted">이름 없이 자리만</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-caption text-muted">
        핀을 다른 자리로 옮기려면 <strong>배선과 코드를 함께</strong> 고쳐야 합니다. 한쪽만 고치면 값이 나오지 않습니다.
      </p>
    </details>
  )
}

export function PartsGroup({ title, lines, note }: { title: string; lines: PartLine[]; note?: string }) {
  if (!lines.length) return null
  return (
    <div className="rounded-card border border-border p-4">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-2 space-y-2">
        {lines.map((line) => (
          <li key={line.name}>
            {/* 등록된 센서는 이름 자체를 설명 화면으로 가는 문이 되게 합니다.
                무엇을 재는 물건인지 모른 채 부품만 챙기게 두지 않기 위해서입니다. */}
            {line.sensorId
              ? <Link className="text-accent hover:underline" to={`/sensors/${line.sensorId}`}>{line.name}</Link>
              : line.name}
            {' '}<span className="text-muted">{line.count}개</span>
            {/* 저항은 값이 인쇄되어 있지 않아 이름만으로는 서랍에서 고를 수 없습니다. */}
            {line.ohms !== undefined && <ResistorBands ohms={line.ohms} />}
            {line.note && <span className="mt-1 block text-caption text-muted">{line.note}</span>}
          </li>
        ))}
      </ul>
      {note && <p className="mt-3 text-caption text-muted">{note}</p>}
    </div>
  )
}
