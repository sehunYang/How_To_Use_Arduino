import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { SafeMarkdown } from '@/components/ui/SafeMarkdown'
import { SimBadge } from '@/components/ui/SimBadge'
import { WiringIllustration } from '@/components/WiringIllustration'
import { canarySimStatus, studentRecipes } from '@/data/studentCatalog'
import { INVENTORY_VERSION } from '@/data/inventory-seed/version'
import { useWiringSteps } from '@/hooks/useWiringSteps'
import { loadProgress, PROGRESS_VERSION, saveProgress } from '@/progress'
import { sendAnonymousEvent } from '@/telemetry/events'
import { authorizeAdminPreview, loadAdminPreviewRecipe } from '@/firebase/adminPreview'
import { loadDynamicSearchIndex, loadPublishedRecipe } from '@/firebase/contentRepository'
import type { Recipe } from '@/schema'
import { planBreadboardWiring } from '@/wokwi/buildDiagram'

export interface PreviewServices {
  authorize: () => Promise<boolean>
  loadRecipe: (recipeId: string) => Promise<Recipe | null>
}

const defaultPreviewServices: PreviewServices = {
  authorize: authorizeAdminPreview,
  loadRecipe: loadAdminPreviewRecipe,
}

function emitStudentEvent(event: Parameters<typeof sendAnonymousEvent>[0]) {
  void sendAnonymousEvent(event).catch(() => undefined)
}

function scrollWindowBy(top: number) {
  if (Math.abs(top) < 1) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  window.scrollBy({ top, behavior: reduce ? 'auto' : 'smooth' })
}

function jumperWireLabel(from: string, to: string): string {
  const endpoints = [from, to].map((endpoint) => endpoint.split('.')[0].toUpperCase())
  const femaleSocketCount = endpoints.filter(
    (endpoint) => endpoint === 'UNO' || endpoint === 'BB' || endpoint.includes('BREADBOARD'),
  ).length
  if (femaleSocketCount === 2) return '수-수(MM) 점퍼선'
  if (femaleSocketCount === 1) return '수-암(MF) 점퍼선'
  return '암-암(FF) 점퍼선'
}

function EndpointLabel({ value }: { value: string }) {
  const separator = value.indexOf('.')
  const component = separator === -1 ? value : value.slice(0, separator)
  const pin = separator === -1 ? '' : value.slice(separator + 1)
  const componentLabel = component.startsWith('CDS_RESISTOR')
    ? '10 kΩ 저항'
    : /^RESISTOR_(\d+)$/.test(component)
      ? `${Number(component.match(/\d+/)?.[0]) >= 1000 ? `${Number(component.match(/\d+/)?.[0]) / 1000} kΩ` : `${component.match(/\d+/)?.[0]} Ω`} 저항`
    : component === 'LOAD' || component === 'LAMP'
      ? '220 Ω 저항'
      : component
  return (
    <span data-wiring-endpoint={value}>
      <span className="text-syntax-type">{componentLabel}</span>
      {pin && <><span className="text-syntax-operator">.</span><span className="text-syntax-property">{pin}</span></>}
    </span>
  )
}

const WIRING_TEXT_TOKEN = /\b(?:[A-Z][A-Z0-9_-]*|[AD]\d+|\d+(?:\.\d+)?\s?(?:kΩ|Ω|V|mA))\b/g
const PIN_NAMES = new Set(['VCC', 'VIN', 'GND', 'SCL', 'SDA', 'AO', 'OUT', 'DATA', 'DQ', 'SIG'])
const WIRE_COLOR_CLASS: Record<string, string> = {
  red: 'text-wire-red',
  black: 'text-wire-black',
  blue: 'text-wire-blue',
  green: 'text-wire-green',
  orange: 'text-wire-orange',
  purple: 'text-wire-purple',
  white: 'text-wire-white',
  yellow: 'text-wire-yellow',
}

function HighlightedWiringText({ text }: { text: string }) {
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

export function RecipeDetailPage({ previewServices = defaultPreviewServices }: { previewServices?: PreviewServices }) {
  const { id = '' } = useParams()
  const location = useLocation()
  const previewRequested = new URLSearchParams(location.search).get('preview') === '1'
  const [previewAuthorized, setPreviewAuthorized] = useState(false)
  const [previewChecked, setPreviewChecked] = useState(!previewRequested)
  const [remoteRecipe, setRemoteRecipe] = useState<Recipe | null>(null)
  const [publicCatalogStatus, setPublicCatalogStatus] = useState<'checking' | 'available' | 'withdrawn'>('checking')
  const bundledRecipe = studentRecipes.find((candidate) => candidate.id === id)
  const recipe = remoteRecipe ?? (publicCatalogStatus !== 'withdrawn' ? bundledRecipe : undefined)
  const stored = useMemo(() => recipe ? loadProgress(recipe.id, recipe.wiring.length, typeof window === 'undefined' ? undefined : window.localStorage) : null, [recipe])
  const machine = useWiringSteps(recipe?.wiring ?? [], stored?.checked)
  const setActiveStep = machine.setActiveStep
  const stepRefs = useRef<Array<HTMLLIElement | null>>([])
  /** 화면 위에 붙어 있는 배선도. 현재 단계를 이 아래로 내려 보내는 데 씁니다. */
  const stickyRef = useRef<HTMLDivElement>(null)
  const [linkCopied, setLinkCopied] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copyPageLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setLinkCopied('copied')
    } catch {
      setLinkCopied('failed')
    }
  }

  useEffect(() => {
    if (previewRequested) return
    let active = true
    void Promise.allSettled([loadPublishedRecipe(id), loadDynamicSearchIndex()])
      .then(([recipeResult, indexResult]) => {
        if (!active) return
        const loaded = recipeResult.status === 'fulfilled' ? recipeResult.value : null
        const index = indexResult.status === 'fulfilled' ? indexResult.value : null
        setRemoteRecipe(loaded)
        setPublicCatalogStatus(index && !index.some((entry) => entry.id === id) ? 'withdrawn' : 'available')
      })
      .catch(() => {
        if (active) setPublicCatalogStatus('available')
      })
    return () => {
      active = false
    }
  }, [id, previewRequested])

  useEffect(() => {
    if (!previewRequested) {
      setPreviewAuthorized(false)
      setPreviewChecked(true)
      return
    }
    let active = true
    void previewServices.authorize()
      .then(async (allowed) => {
        if (!active) return
        setPreviewAuthorized(allowed)
        if (allowed && !studentRecipes.some((candidate) => candidate.id === id)) {
          setRemoteRecipe(await previewServices.loadRecipe(id))
        }
      })
      .catch(() => {
        if (active) setPreviewAuthorized(false)
      })
      .finally(() => {
        if (active) setPreviewChecked(true)
      })
    return () => { active = false }
  }, [id, previewRequested, previewServices])

  useEffect(() => {
    const match = location.hash.match(/^#step-(\d+)$/)
    if (match && recipe) setActiveStep(Math.min(recipe.wiring.length - 1, Math.max(0, Number(match[1]) - 1)))
  }, [location.hash, recipe, setActiveStep])

  useEffect(() => {
    if (!recipe) return
    saveProgress({ version: PROGRESS_VERSION, recipeId: recipe.id, checked: machine.checked, updatedAt: new Date().toISOString() }, window.localStorage)
  }, [machine.checked, recipe])

  useEffect(() => {
    if (recipe?.status === 'published') emitStudentEvent({ recipeId: recipe.id, event: 'start' })
  }, [recipe])

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

  if (previewRequested && !previewChecked) {
    return <p className="py-20 text-center text-muted">미리보기 권한을 확인하고 있습니다…</p>
  }

  if (!recipe || (recipe.status !== 'published' && !previewAuthorized)) {
    return <div className="mx-auto max-w-2xl py-20 text-center"><h1 className="text-3xl font-semibold">이 레시피는 현재 볼 수 없어요</h1><p className="mt-3 text-muted">게시가 취소되었거나 주소가 바뀌었을 수 있습니다.</p><Link className="mt-6 inline-block text-accent hover:underline" to="/">검색으로 돌아가기</Link></div>
  }

  const activeRecipe = recipe
  const active = machine.activeStep ?? 0
  const plannedWiring = planBreadboardWiring(recipe)
  function toggleStep(index: number, checked: boolean) {
    if (checked) machine.checkStep(index)
    else machine.uncheckStep(index)
    if (checked) {
      emitStudentEvent({ recipeId: activeRecipe.id, event: 'step_check', step: index })
      const willComplete = machine.checked.every((value, step) => value || step === index)
      if (willComplete) emitStudentEvent({ recipeId: activeRecipe.id, event: 'complete' })
    }
  }

  return (
    <article className="mx-auto max-w-6xl pb-24">
      {previewRequested && previewAuthorized && <div className="sticky top-16 z-30 -mx-page mb-4 bg-warning-background px-page py-2 text-center font-semibold text-warning">관리자 미리보기 · 학생 화면과 동일한 레이아웃</div>}
      <Link to="/recipes" className="text-caption text-accent hover:underline">← 레시피 목록</Link>
      <header className="mt-5 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-3"><span className="text-caption text-muted">{recipe.subject ?? '융합'} · {recipe.difficulty} · {recipe.minutes}분</span><SimBadge recipe={recipe} status={canarySimStatus[recipe.id]} inventoryVersion={INVENTORY_VERSION} /></div>
        <h1 className="mt-3 text-4xl font-semibold">{recipe.title}</h1>
      </header>

      <section aria-labelledby="wiring-title" className="mt-8">
        <h2 id="wiring-title" className="text-2xl font-semibold">1. 배선하기</h2>
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
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-page pt-3 [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))] lg:static lg:mt-5 lg:border-0 lg:p-0">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <Button variant="outline" disabled={active === 0} onClick={() => machine.setActiveStep(active - 1)}>이전</Button>
            <span className="text-caption text-muted">{machine.checked.filter(Boolean).length}/{recipe.wiring.length} 완료</span>
            <Button disabled={active >= recipe.wiring.length - 1} onClick={() => machine.setActiveStep(active + 1)}>다음</Button>
          </div>
        </div>
        {machine.completed && (
          <aside className="mt-6 rounded-card border border-success bg-success-background p-5">
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
      </section>

      <section className="mt-12" aria-labelledby="code-title"><h2 id="code-title" className="text-2xl font-semibold">2. 코드 넣기</h2><div className="mt-4 overflow-hidden rounded-card border border-border"><CodeBlock code={recipe.sketch} tunables={recipe.tunables} /></div></section>
      <section className="prose mt-12 max-w-3xl" aria-labelledby="guide-title"><h2 id="guide-title" className="text-2xl font-semibold">3. 탐구 가이드</h2><SafeMarkdown source={recipe.body} /></section>
      <section className="mt-12 max-w-3xl" aria-labelledby="application-title"><h2 id="application-title" className="text-2xl font-semibold">응용해 보기</h2><div className="mt-3 text-muted"><SafeMarkdown source={recipe.applicationGuide} /></div></section>
      <section className="mt-12 max-w-3xl" aria-labelledby="trouble-title"><h2 id="trouble-title" className="text-2xl font-semibold">문제가 생겼나요?</h2><div className="mt-4 space-y-3">{recipe.troubleshooting.map((item) => <details key={item.symptom} className="rounded-card border border-border p-4"><summary className="cursor-pointer font-semibold">{item.symptom}</summary><p className="mt-3 text-muted">원인: {item.cause}</p><p className="mt-2">해결: {item.fix}</p></details>)}</div></section>
    </article>
  )
}
