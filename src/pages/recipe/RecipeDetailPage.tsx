import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { SimBadge } from '@/components/ui/SimBadge'
import { canarySimStatus, studentRecipes } from '@/data/studentCatalog'
import { INVENTORY_VERSION } from '@/data/inventory-seed/version'
import { useWiringSteps } from '@/hooks/useWiringSteps'
import { loadProgress, PROGRESS_VERSION, saveProgress } from '@/progress'
import { sendAnonymousEvent } from '@/telemetry/events'
import { authorizeAdminPreview, loadAdminPreviewRecipe } from '@/firebase/adminPreview'
import { loadDynamicSearchIndex, loadPublishedRecipe } from '@/firebase/contentRepository'
import { firstRunTroubleshooting } from '@/recipes/firstRun'
import type { RecipeLink } from '@/recipes/relatedRecipes'
import type { Recipe } from '@/schema'
import { CodePage } from './CodePage'
import { DesignPage } from './DesignPage'
import { MeasurePage } from './MeasurePage'
import { OverviewPage } from './OverviewPage'
import { PartsPage } from './PartsPage'
import { RecipeContextProvider } from './RecipeContext'
import { HelpCard } from './shared'
import { RECIPE_STEPS, stepByPath, stepHeading, stepPath } from './steps'
import { WiringPage } from './WiringPage'

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

/**
 * 레시피 한 편의 껍데기.
 *
 * 레시피를 내려받고, 머리글과 단계 이동 줄을 그리고, 어느 단계 화면을 그릴지
 * 고릅니다. 단계마다 다시 받지 않도록 레시피와 배선 진행은 여기에서 한 벌만
 * 들고 자식에게 내려 줍니다.
 *
 * 문제 해결과 도움 카드는 단계마다 접힌 채로 아래에 붙습니다. 막히는 순간은
 * 어느 단계에서든 오는데, 그때 다른 화면으로 보내면 하던 일을 잃습니다.
 */
export function RecipeDetailPage({ previewServices = defaultPreviewServices }: { previewServices?: PreviewServices }) {
  const { id = '', '*': rest } = useParams()
  const location = useLocation()
  const previewRequested = new URLSearchParams(location.search).get('preview') === '1'
  const [previewAuthorized, setPreviewAuthorized] = useState(false)
  const [previewChecked, setPreviewChecked] = useState(!previewRequested)
  const [remoteRecipe, setRemoteRecipe] = useState<Recipe | null>(null)
  const [publicCatalogStatus, setPublicCatalogStatus] = useState<'checking' | 'available' | 'withdrawn' | 'unreachable'>('checking')
  // 가이드가 이름으로 가리키는 다음 탐구를 링크로 바꾸는 데 씁니다. 색인을 아직
  // 받지 못했으면 번들에 든 레시피만으로도 시작할 수 있게 미리 채워 둡니다.
  const [catalog, setCatalog] = useState<RecipeLink[]>(() =>
    studentRecipes.map((entry) => ({ id: entry.id, title: entry.title })))
  const bundledRecipe = studentRecipes.find((candidate) => candidate.id === id)
  const recipe = remoteRecipe ?? (publicCatalogStatus !== 'withdrawn' ? bundledRecipe : undefined)
  const stored = useMemo(() => recipe ? loadProgress(recipe.id, recipe.wiring.length, typeof window === 'undefined' ? undefined : window.localStorage) : null, [recipe])
  const machine = useWiringSteps(recipe?.wiring ?? [], stored?.checked)

  useEffect(() => {
    if (previewRequested) return
    let active = true
    void Promise.allSettled([loadPublishedRecipe(id), loadDynamicSearchIndex()])
      .then(([recipeResult, indexResult]) => {
        if (!active) return
        const loaded = recipeResult.status === 'fulfilled' ? recipeResult.value : null
        const index = indexResult.status === 'fulfilled' ? indexResult.value : null
        setRemoteRecipe(loaded)
        if (index?.length) setCatalog(index.map((entry) => ({ id: entry.id, title: entry.title })))
        // 색인에 없으면 게시가 취소된 것이고, 색인과 상관없이 번들에도 없는 레시피를 못
        // 받았으면 닿지 못한 것입니다. 둘을 같은 문장으로 알리면 학생은 없는 레시피를 찾아 헤맵니다.
        setPublicCatalogStatus(
          index && !index.some((entry) => entry.id === id)
            ? 'withdrawn'
            : !loaded && !studentRecipes.some((candidate) => candidate.id === id)
              ? 'unreachable'
              : 'available',
        )
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
    if (!recipe) return
    saveProgress({ version: PROGRESS_VERSION, recipeId: recipe.id, checked: machine.checked, updatedAt: new Date().toISOString() }, window.localStorage)
  }, [machine.checked, recipe])

  useEffect(() => {
    if (recipe?.status === 'published') emitStudentEvent({ recipeId: recipe.id, event: 'start' })
  }, [recipe])

  if (previewRequested && !previewChecked) {
    return <p className="py-20 text-center text-muted">미리보기 권한을 확인하고 있습니다…</p>
  }

  // 미리보기는 공개 목록을 묻지 않으므로 '확인 중'이 끝나지 않습니다. 그 길은 아래 판단으로 보냅니다.
  if (!recipe && !previewRequested && publicCatalogStatus === 'checking') {
    return <p className="py-20 text-center text-muted">레시피를 불러오고 있습니다…</p>
  }

  if (!recipe && publicCatalogStatus === 'unreachable') {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <h1 className="text-3xl font-semibold">지금은 레시피를 불러오지 못했어요</h1>
        <p className="mt-3 text-muted">인터넷 연결을 확인하고 새로 고침하세요. 학교 네트워크가 구글 reCAPTCHA를 막고 있으면 다른 네트워크에서 열어야 합니다.</p>
        <Button className="mt-6" onClick={() => window.location.reload()}>새로 고침</Button>
      </div>
    )
  }

  if (!recipe || (recipe.status !== 'published' && !previewAuthorized)) {
    return <div className="mx-auto max-w-2xl py-20 text-center"><h1 className="text-3xl font-semibold">이 레시피는 현재 볼 수 없어요</h1><p className="mt-3 text-muted">게시가 취소되었거나 주소가 바뀌었을 수 있습니다.</p><Link className="mt-6 inline-block text-accent hover:underline" to="/">검색으로 돌아가기</Link></div>
  }

  const activeRecipe = recipe
  const current = stepByPath(rest)
  const currentIndex = RECIPE_STEPS.indexOf(current)
  const previousStep = currentIndex > 0 ? RECIPE_STEPS[currentIndex - 1] : null
  const nextStep = currentIndex >= 0 && currentIndex < RECIPE_STEPS.length - 1 ? RECIPE_STEPS[currentIndex + 1] : null
  const checkedSteps = machine.checked.filter(Boolean).length
  // 레시피가 쓴 증상을 먼저 보여 주고, 어느 레시피에서나 똑같이 겪는 첫 실행
  // 문제를 뒤에 붙입니다. 같은 증상을 이미 적어 둔 레시피는 그것을 남깁니다.
  const troubleshooting = [
    ...recipe.troubleshooting,
    ...firstRunTroubleshooting(recipe.baudRate).filter(
      (item) => !recipe.troubleshooting.some((authored) => authored.symptom === item.symptom),
    ),
  ]

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
    <RecipeContextProvider value={{ recipe, machine, catalog, toggleStep }}>
      <article className="mx-auto max-w-6xl pb-24">
        {previewRequested && previewAuthorized && <div className="sticky top-16 z-30 -mx-page mb-4 bg-warning-background px-page py-2 text-center font-semibold text-warning">관리자 미리보기 · 학생 화면과 동일한 레이아웃</div>}
        <Link to="/recipes" className="text-caption text-accent hover:underline">← 레시피 목록</Link>
        <header className="mt-5 border-b border-border pb-6">
          <div className="flex flex-wrap items-center gap-3"><span className="text-caption text-muted">{recipe.subject ?? '융합'} · {recipe.difficulty} · {recipe.minutes}분</span><SimBadge recipe={recipe} status={canarySimStatus[recipe.id]} inventoryVersion={INVENTORY_VERSION} /></div>
          <h1 className="mt-3 text-4xl font-semibold">{recipe.title}</h1>
        </header>

        {/* 지금 어느 단계에 있는지와 다른 단계로 가는 길을 한 줄에 둡니다. 주소가
            단계마다 다르므로 이 줄은 화면 안 이동이 아니라 진짜 이동입니다. */}
        <nav aria-label="이 레시피의 단계" className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-b border-border pb-4 text-caption">
          {RECIPE_STEPS.map((step) => (
            <Link
              key={step.path}
              to={stepPath(recipe.id, step)}
              aria-current={step === current ? 'page' : undefined}
              className={step === current ? 'font-semibold text-foreground' : 'text-accent hover:underline'}
            >
              {step.number === null ? step.label : `${step.number}. ${step.label}`}
            </Link>
          ))}
        </nav>

        {current.path && <h2 className="mt-8 text-2xl font-semibold">{stepHeading(current)}</h2>}

        <div className="mt-6">
          <Routes>
            <Route index element={<OverviewPage />} />
            <Route path="parts" element={<PartsPage />} />
            <Route path="wiring" element={<WiringPage />} />
            <Route path="code" element={<CodePage />} />
            <Route path="design" element={<DesignPage />} />
            <Route path="measure" element={<MeasurePage />} />
            {/* 없는 조각으로 들어오면 허브로 보냅니다. 옛 주소의 해시(#step-3)도
                여기로 오는데, 그때는 배선 화면이 아니라 허브에서 다시 고르게 둡니다. */}
            <Route path="*" element={<Navigate to={stepPath(recipe.id, RECIPE_STEPS[0])} replace />} />
          </Routes>
        </div>

        {/* 다음 단계로 가는 길은 화면 끝에 둡니다. 위쪽 이동 줄은 건너뛸 때 쓰고,
            이 줄은 하던 일을 마치고 이어서 갈 때 씁니다. */}
        <nav aria-label="단계 이동" className="mt-12 flex items-center justify-between gap-3 border-t border-border pt-5">
          {previousStep
            ? <Link className="text-accent hover:underline" to={stepPath(recipe.id, previousStep)}>← {stepHeading(previousStep)}</Link>
            : <span />}
          {nextStep
            ? <Link className="text-accent hover:underline" to={stepPath(recipe.id, nextStep)}>{stepHeading(nextStep)} →</Link>
            : <span />}
        </nav>

        <section className="mt-12 max-w-3xl" aria-labelledby="trouble-title">
          <h2 id="trouble-title" className="text-2xl font-semibold">문제가 생겼나요?</h2>
          <div className="mt-4 space-y-3">
            {troubleshooting.map((item) => (
              <details key={item.symptom} className="rounded-card border border-border p-4">
                <summary className="cursor-pointer font-semibold">{item.symptom}</summary>
                <p className="mt-3 text-muted">원인: {item.cause}</p>
                <p className="mt-2">해결: {item.fix}</p>
              </details>
            ))}
          </div>
          <HelpCard recipe={activeRecipe} checkedSteps={checkedSteps} />
        </section>
      </article>
    </RecipeContextProvider>
  )
}
