import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { publishedRecipes } from '@/data/studentCatalog'
import { loadRecentProgress } from '@/progress'

const examples = ['진자의 움직임을 측정하고 싶어요', '전류와 전력을 재고 싶어요', '빛 센서 여러 개를 연결하고 싶어요']

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
      <p className="text-caption font-semibold uppercase tracking-widest text-accent">탐구 아이디어에서 배선까지</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">무엇을 측정하고 싶은지 편하게 적어보세요.</h1>
      <p className="mt-5 max-w-2xl text-body text-muted">센서를 이미 알고 있을 필요는 없습니다. 하고 싶은 탐구를 적으면 필요한 센서와 검증된 레시피를 함께 찾아드립니다.</p>
      <form
        className="mt-8 rounded-card border border-border bg-muted-background p-3"
        onSubmit={(event) => { event.preventDefault(); submit(query) }}
      >
        <label className="sr-only" htmlFor="inquiry">탐구 아이디어</label>
        <textarea
          id="inquiry"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-h-28 w-full resize-y bg-transparent p-3 text-body outline-none"
          placeholder="예: 진자 길이에 따라 움직임이 어떻게 달라지는지 측정하고 싶어요"
        />
        <div className="flex justify-end"><Button type="submit" size="lg">레시피 찾기</Button></div>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {examples.map((example) => <Button key={example} variant="outline" size="sm" onClick={() => submit(example)}>{example}</Button>)}
      </div>
      {resume && (
        <aside className="mt-10 rounded-card border border-accent bg-muted-background p-5">
          <p className="text-caption font-semibold text-accent">이어서 하기</p>
          <p className="mt-1">{resume.activeStep + 1}단계부터 배선을 계속할 수 있어요.</p>
          <Button className="mt-4" onClick={() => navigate(`/recipes/${resume.recipeId}#step-${resume.activeStep + 1}`)}>계속하기</Button>
        </aside>
      )}
    </div>
  )
}
