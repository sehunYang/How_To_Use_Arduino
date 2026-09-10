import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { BreadboardMap } from '@/components/BreadboardMap'
import { Button } from '@/components/ui/button'
import { WiringIllustration } from '@/components/WiringIllustration'
import { breadboardBasics, safetyNotice } from '@/recipes/firstRun'
import { glossaryFor } from '@/recipes/glossary'
import { jumperWireLabel } from '@/recipes/parts'
import { powerChecks } from '@/recipes/powerCheck'
import { planBreadboardWiring } from '@/wokwi/buildDiagram'
import { useRecipeContext } from './RecipeContext'
import { EndpointLabel, GlossaryList, HighlightedWiringText, PowerCheckList, WIRE_COLOR_CLASS } from './shared'

function scrollWindowBy(top: number) {
  if (Math.abs(top) < 1) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  window.scrollBy({ top, behavior: reduce ? 'auto' : 'smooth' })
}

export function WiringPage() {
  const { recipe, machine, toggleStep } = useRecipeContext()
  const location = useLocation()
  const stepRefs = useRef<Array<HTMLLIElement | null>>([])
  /** 화면 위에 붙어 있는 배선도. 현재 단계를 이 아래로 내려 보내는 데 씁니다. */
  const stickyRef = useRef<HTMLDivElement>(null)
  const [linkCopied, setLinkCopied] = useState<'idle' | 'copied' | 'failed'>('idle')

  const active = machine.activeStep ?? 0
  const plannedWiring = planBreadboardWiring(recipe)
  const safety = safetyNotice(recipe.body)
  const checks = powerChecks(recipe)
  const glossary = glossaryFor(recipe)
  const setActiveStep = machine.setActiveStep

  async function copyPageLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setLinkCopied('copied')
    } catch {
      setLinkCopied('failed')
    }
  }

  useEffect(() => {
    const match = location.hash.match(/^#step-(\d+)$/)
    if (match) setActiveStep(Math.min(recipe.wiring.length - 1, Math.max(0, Number(match[1]) - 1)))
  }, [location.hash, recipe.wiring.length, setActiveStep])

  /**
   * 현재 단계를 배선도 **아래**로 데려옵니다.
   *
   * `scrollIntoView({ block: 'nearest' })`는 화면 위에 붙어 있는 것을 모릅니다.
   * 배선도가 화면 위쪽에 붙어 화면의 절반 넘게 덮고 있으므로, 브라우저가 "이미 보인다"고
   * 판단한 자리가 사실은 배선도 뒤였습니다. 다음 단계를 눌러도 이어야 할 두 핀과 점퍼선
   * 색이 적힌 문장이 그림에 가려 보이지 않았습니다. 그래서 배선도의 실제 아래쪽 좌표를
   * 재서, 단계 카드가 그보다 위에 있으면 그만큼 내려 줍니다.
   */
  useEffect(() => {
    if (machine.activeStep === null) return
    const node = stepRefs.current[machine.activeStep]
    if (!node) return

    const gap = 12
    const sticky = stickyRef.current
    const stickyBox = sticky?.getBoundingClientRect()
    // 배선도는 아직 글 흐름 안에 있을 수도, 이미 화면 위에 붙어 있을 수도 있습니다.
    // 옮기고 나면 붙어 있을 자리를 기준으로 재야, 옮긴 뒤에 다시 가려지지 않습니다.
    const pinnedTop = sticky ? Number.parseFloat(getComputedStyle(sticky).top) || 0 : 0
    const coveredUntil = stickyBox ? Math.min(stickyBox.bottom, pinnedTop + stickyBox.height) : 0
    const box = node.getBoundingClientRect()

    if (box.top < coveredUntil + gap) {
      scrollWindowBy(box.top - coveredUntil - gap)
    } else if (box.bottom > window.innerHeight) {
      // 단계 카드가 남은 자리보다 길면 아래쪽을 맞추려다 위쪽 문장을 가립니다. 위쪽을 살립니다.
      scrollWindowBy(Math.min(box.top - coveredUntil - gap, box.bottom - window.innerHeight + gap))
    }
  }, [machine.activeStep])

  return (
    <div>
      {/* 안전 안내는 꽂기 전에 읽어야 뜻이 있습니다. 본문 안에 두면 다 꽂은 뒤에 만납니다. */}
      <aside className="max-w-3xl rounded-card border border-warning bg-warning-background p-4">
        <strong className="text-warning">꽂기 전에 읽으세요</strong>
        <p className="mt-1 text-caption">{safety}</p>
      </aside>

      {/* 단계는 "어디에 꽂는가"만 알려 줍니다. 한 칸 밀려 꽂았을 때 스스로 되짚으려면
          어떤 구멍이 서로 이어져 있는지를 알아야 하므로 단계보다 먼저 둡니다. */}
      <details className="mt-4 max-w-3xl rounded-card border border-border p-4">
        <summary className="cursor-pointer font-semibold">
          브레드보드가 처음이라면: 어떤 구멍이 서로 이어져 있나
        </summary>
        <BreadboardMap />
        <ul className="mt-3 space-y-3">
          {breadboardBasics.map((item) => (
            <li key={item.title}>
              <strong>{item.title}</strong>
              <span className="mt-1 block text-caption text-muted">{item.detail}</span>
            </li>
          ))}
        </ul>
      </details>

      <div data-testid="wiring-layout" className="mt-5 min-w-0 space-y-6">
        <div ref={stickyRef} className="sticky top-16 z-20 w-full bg-background pb-2 lg:top-20"><WiringIllustration recipe={recipe} activeStep={active} /></div>
        <ol data-testid="wiring-steps" className="min-w-0 space-y-3">
          {recipe.wiring.map((step, index) => (
            <li
              id={`step-${index + 1}`}
              ref={(node) => { stepRefs.current[index] = node }}
              key={`${step.from}-${step.to}`}
              className={`scroll-mt-24 rounded-card border p-4 ${active === index ? 'border-accent bg-muted-background' : 'border-border'}`}
            >
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <input className="mt-1 size-5 accent-accent" type="checkbox" checked={machine.checked[index] ?? false} onChange={(event) => toggleStep(index, event.target.checked)} onFocus={() => machine.setActiveStep(index)} />
                <span>
                  <strong>
                    <span className="text-syntax-number">{index + 1}</span>
                    <span className="text-syntax-operator">. </span>
                    <EndpointLabel value={step.from} />
                    <span className="text-syntax-operator">
                      {plannedWiring.some(
                        (connection) => connection.stepIndex === index
                          && (connection.from.startsWith('BB.') || connection.to.startsWith('BB.')),
                      ) ? ' → 브레드보드 → ' : ' → '}
                    </span>
                    <EndpointLabel value={step.to} />
                  </strong>
                  <span className="mt-1 block text-caption">
                    <span className="text-syntax-string">{jumperWireLabel(step.from, step.to)}</span>
                    <span className="text-muted"> · </span>
                    <HighlightedWiringText text={step.text} />
                    {plannedWiring
                      .filter((connection) => connection.stepIndex === index)
                      .map((connection) => (
                        <span
                          key={`${connection.from}-${connection.to}`}
                          className="mt-1 block text-muted"
                        >
                          {connection.from} → {connection.to}
                        </span>
                      ))}
                    <span className="text-muted"> · </span>
                    <span className={WIRE_COLOR_CLASS[step.color.toLowerCase()] ?? 'text-syntax-function'}>
                      {step.color} 선
                    </span>
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ol>
      </div>

      <PowerCheckList checks={checks} recipeId={recipe.id} />

      <GlossaryList title="이 단계에 나오는 말의 뜻" entries={glossary.wiring} />

      {/* 이 줄은 배선 화면에만 있으므로 조건 없이 아래에 붙여 둡니다. 예전에는 한
          화면에 다섯 절이 모두 있어서, 코드와 가이드를 읽는 내내 "1/8 완료"가
          화면 아래를 덮었습니다. 그래서 배선이 보일 때만 그리는 관찰자를 달아
          두었는데, 화면이 갈라지면서 그 관찰자가 할 일이 없어졌습니다. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-page pt-3 [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))] lg:static lg:mt-5 lg:border-0 lg:p-0">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Button variant="outline" disabled={active === 0} onClick={() => machine.setActiveStep(active - 1)}>이전</Button>
          <span className="text-caption text-muted">{machine.checked.filter(Boolean).length}/{recipe.wiring.length} 완료</span>
          <Button disabled={active >= recipe.wiring.length - 1} onClick={() => machine.setActiveStep(active + 1)}>다음</Button>
        </div>
      </div>

      {machine.completed && (
        <aside className="mt-6 max-w-3xl rounded-card border border-success bg-success-background p-5">
          <h3 className="font-semibold text-success">배선 완료 → 이제 코드를 실행할 차례예요</h3>
          <p className="mt-2 text-caption">PC에서 이어서 하려면 주소를 옮겨 가세요.</p>
          <Button className="mt-3" variant="outline" onClick={() => void copyPageLink()}>
            {linkCopied === 'copied' ? '주소 복사됨' : linkCopied === 'failed' ? '복사 실패' : '페이지 주소 복사'}
          </Button>
          {/* 눌러도 아무 표시가 없으면 학생은 눌린 것인지 알 수 없어 계속 다시 누릅니다. */}
          <span className="sr-only" aria-live="polite">
            {linkCopied === 'copied' ? '페이지 주소가 클립보드에 복사되었습니다.' : ''}
          </span>
          {linkCopied === 'failed' && (
            <p className="mt-2 text-caption">이 브라우저에서는 복사할 수 없습니다. 주소 표시줄의 주소를 직접 옮겨 적으세요.</p>
          )}
        </aside>
      )}
    </div>
  )
}
