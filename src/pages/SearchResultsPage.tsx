import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RecipeCard } from '@/components/RecipeCard'
import { studentRecipes, rationaleFor, sensorById } from '@/data/studentCatalog'
import { synonyms } from '@/data/synonyms'
import { buildIndex, search } from '@/search'
import { normalizeSearchTokens, sendAnonymousEvent } from '@/telemetry/events'

export function SearchResultsPage() {
  const [params] = useSearchParams()
  const query = params.get('q')?.trim() ?? ''
  const index = buildIndex(studentRecipes)
  const results = search(query, index, synonyms)
  const usedFuzzyFallback = results.some((result) => result.via === 'fuzzy')
  useEffect(() => {
    if (query && usedFuzzyFallback) {
      void sendAnonymousEvent({
        recipeId: 'search',
        event: 'search_fail',
        tokens: normalizeSearchTokens(query),
      }).catch(() => undefined)
    }
  }, [query, usedFuzzyFallback])
  const sensorIds = [...new Set(results.flatMap((result) => result.entry.sensors))]

  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/" className="text-caption text-accent hover:underline">← 다른 아이디어 검색</Link>
      <h1 className="mt-4 text-3xl font-semibold">“{query || '전체'}” 검색 결과</h1>
      <section aria-labelledby="sensor-summary" className="mt-8">
        <h2 id="sensor-summary" className="text-heading font-semibold">필요한 센서</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {sensorIds.map((id) => {
            const sensor = sensorById.get(id)
            const rationale = rationaleFor(id, results.find((result) => result.entry.sensors.includes(id))?.entry.subject ?? null)
            return (
              <article key={id} className="rounded-card border border-border p-4">
                <h3 className="font-semibold">{sensor?.name ?? id}</h3>
                <p className="mt-1 text-caption text-muted">{rationale?.whyText ?? '이 탐구의 값을 직접 측정하는 데 필요한 센서입니다.'}</p>
              </article>
            )
          })}
        </div>
      </section>
      <section aria-labelledby="recipe-results" className="mt-10">
        <h2 id="recipe-results" className="text-heading font-semibold">추천 레시피</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map((result) => <RecipeCard key={result.entry.id} recipe={result.entry} matchedKeywords={result.matchedKeywords} fuzzy={result.via === 'fuzzy'} />)}
        </div>
      </section>
    </div>
  )
}
