import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RecipeCard } from '@/components/RecipeCard'
import { synonyms } from '@/data/synonyms'
import { buildIndex, search } from '@/search'
import { normalizeSearchTokens, sendAnonymousEvent } from '@/telemetry/events'
import { profileForSensor } from '@/data/sensorProfiles'
import { SensorCard } from '@/components/SensorCard'
import { canaryRationales } from '@/data/canary'
import { rankSensors } from '@/results/aggregateSensors'
import { useSensorInventory } from '@/firebase/sensorInventory'
import { usePublishedRecipes } from '@/firebase/contentRepository'

export function SearchResultsPage() {
  const studentRecipes = usePublishedRecipes()
  const sensorById = new Map(useSensorInventory().map((sensor) => [sensor.id, sensor]))
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
  const rankedSensors = rankSensors(results, canaryRationales)

  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/" className="text-caption text-accent hover:underline">← 다른 아이디어 검색</Link>
      <h1 className="mt-4 text-3xl font-semibold">“{query || '전체'}” 검색 결과</h1>
      <section aria-labelledby="sensor-summary" className="mt-8">
        <h2 id="sensor-summary" className="text-heading font-semibold">필요한 센서</h2>
        <div className="mt-3 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rankedSensors.map(({ sensorId: id, whyText }) => {
            const sensor = sensorById.get(id)
            return sensor
              ? <SensorCard key={id} sensor={sensor} profile={profileForSensor(sensor)} reason={whyText} />
              : null
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
