import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { publishedRecipes } from '@/data/studentCatalog'
import { loadRecentProgress } from '@/progress'

const examples = ['진자의 움직임을 측정하고 싶어요', '전류와 전력을 재고 싶어요', '빛 센서 여러 개를 연결하고 싶어요']

/** 탐구 한 번을 끝까지 마치는 데 필요한 화면들. 순서가 곧 실험의 순서입니다. */
const guideSteps = [
  { to: '/recipes', step: '1. 만들기', title: '레시피 둘러보기', body: '배선도와 코드를 따라 회로 완성' },
  { to: '/sensors', step: '2. 알아보기', title: '센서 학습하기', body: '무엇을 어떻게 재는 센서인지 확인' },
  { to: '/data-analysis', step: '3. 분석하기', title: '데이터 변환·분석', body: '측정값을 표·통계·그래프로 정리' },
]

export function DiscoveryPage() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const resume = useMemo(() => loadRecentProgress(publishedRecipes.map((recipe) => recipe.id)), [])

  function submit(value: string) {
    const trimmed = value.trim()
    if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="mx-auto max-w-4xl py-8 md:py-16">
      <p className="text-caption font-semibold uppercase tracking-widest text-accent">탐구 주제에서 결과 분석까지</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">무엇을 측정하고 싶은지 편하게 적어보세요.</h1>
      <p className="mt-5 max-w-2xl text-body text-muted">
        센서 이름을 몰라도 됩니다. 하고 싶은 탐구를 적으면 필요한 센서와 레시피를 찾아 드립니다.
      </p>
      <form
        className="mt-8 rounded-card border border-border bg-muted-background p-3"
        onSubmit={(event) => { event.preventDefault(); submit(query) }}
      >
        <label className="sr-only" htmlFor="inquiry">탐구 아이디어</label>
        <textarea
          id="inquiry"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-h-28 w-full resize-y bg-transparent p-3 text-body"
          placeholder="예: 진자 길이에 따라 움직임이 어떻게 달라지는지 측정하고 싶어요"
        />
        <div className="flex justify-end"><Button type="submit" size="lg">레시피 찾기</Button></div>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {examples.map((example) => <Button key={example} variant="outline" size="sm" onClick={() => submit(example)}>{example}</Button>)}
      </div>
      {resume && (
        <aside aria-labelledby="resume-title" className="mt-10 rounded-card border border-accent bg-muted-background p-5">
          <p id="resume-title" className="text-caption font-semibold text-accent">이어서 하기</p>
          <p className="mt-1">{resume.activeStep + 1}단계부터 배선을 계속할 수 있어요.</p>
          <Button className="mt-4" onClick={() => navigate(`/recipes/${resume.recipeId}#step-${resume.activeStep + 1}`)}>계속하기</Button>
        </aside>
      )}

      <section aria-labelledby="site-guide" className="mt-16">
        <h2 id="site-guide" className="text-heading font-semibold">이곳에서 할 수 있는 일</h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {guideSteps.map((entry) => (
            <li key={entry.to}>
              <Link
                to={entry.to}
                className="flex h-full flex-col rounded-card border border-border p-5 hover:border-accent hover:bg-muted-background"
              >
                <span className="text-caption font-semibold text-accent">{entry.step}</span>
                <span className="mt-2 text-body font-semibold">{entry.title}</span>
                <span className="mt-2 text-caption text-muted">{entry.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="trust-notes" className="mt-12 rounded-card border border-border bg-muted-background p-5">
        <h2 id="trust-notes" className="text-body font-semibold">이 안내서가 지키는 것</h2>
        <ul className="mt-3 space-y-2 text-caption text-muted">
          <li>· 배선도는 부품의 실제 핀 좌표에 맞춰 그립니다.</li>
          <li>· 레시피의 코드는 실제로 컴파일해 확인합니다.</li>
          <li>· 붙여넣은 측정값은 이 브라우저 밖으로 나가지 않습니다.</li>
        </ul>
      </section>
    </div>
  )
}
