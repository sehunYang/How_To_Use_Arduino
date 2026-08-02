import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RecipeCard } from '@/components/RecipeCard'
import { synonyms } from '@/data/synonyms'
import { buildIndex, search } from '@/search'
import { normalizeSearchTokens, sendAnonymousEvent } from '@/telemetry/events'
import { profileForSensor } from '@/data/sensorProfiles'
import { SensorCard } from '@/components/SensorCard'
import { sensorRationales } from '@/data/sensorRationales'
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
  /**
   * 딱 맞는 레시피가 하나도 없으면 검색은 비슷해 보이는 것들을 대신 내놓습니다.
   * 그 사실을 말해 주지 않으면, 학생은 화면에 뜬 레시피가 자기가 적은 탐구에 맞는 답이라고
   * 믿게 됩니다. 몇 개를 왜 보여 주는지 먼저 밝힙니다.
   */
  const exactCount = results.filter((result) => result.via !== 'fuzzy').length
  // 사전 매칭이 전혀 없었을 때만 실패로 기록합니다. 결과 3개를 채우려고 붙인
  // 퍼지 패딩까지 실패로 세면, 유의어 사전을 키울 근거 데이터가 오염됩니다.
  const dictionaryMissed = exactCount === 0
  useEffect(() => {
    if (query && dictionaryMissed) {
      void sendAnonymousEvent({
        recipeId: 'search',
        event: 'search_fail',
        tokens: normalizeSearchTokens(query),
      }).catch(() => undefined)
    }
  }, [query, dictionaryMissed])
  const rankedSensors = rankSensors(results, sensorRationales)
  const sensorCards = rankedSensors
    .map(({ sensorId, whyText }) => ({ sensor: sensorById.get(sensorId), whyText }))
    .filter((card): card is { sensor: NonNullable<typeof card.sensor>; whyText: string } => Boolean(card.sensor))
  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/" className="text-caption text-accent hover:underline">← 다른 아이디어 검색</Link>
      <h1 className="mt-4 text-3xl font-semibold">“{query || '전체'}” 검색 결과</h1>
      <p aria-live="polite" className="mt-3 text-body text-muted">
        {results.length === 0
          ? '적어 주신 내용과 이어지는 레시피를 찾지 못했습니다.'
          : exactCount === 0
            ? `딱 맞는 레시피는 찾지 못해, 비슷한 탐구 ${results.length}개를 대신 보여 드립니다.`
            : `레시피 ${exactCount}개를 찾았습니다.${results.length > exactCount ? ` 비슷한 탐구 ${results.length - exactCount}개도 함께 보여 드립니다.` : ''}`}
      </p>

      {results.length === 0 ? (
        <div className="mt-8 rounded-card border border-border p-8">
          <p className="font-semibold">재고 싶은 것을 한 낱말로 적어 보세요. 예: 온도, 거리, 밝기, 전류</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="inline-flex h-10 items-center rounded-card bg-accent px-4 text-accent-foreground" to="/">다시 검색하기</Link>
            <Link className="inline-flex h-10 items-center rounded-card border border-border px-4 hover:bg-muted-background" to="/recipes">레시피 전체 둘러보기</Link>
          </div>
        </div>
      ) : (
        <>
          {sensorCards.length > 0 && (
            <section aria-labelledby="sensor-summary" className="mt-8">
              <h2 id="sensor-summary" className="text-heading font-semibold">필요한 센서</h2>
              <div className="mt-3 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {sensorCards.map(({ sensor, whyText }) => (
                  <SensorCard key={sensor.id} sensor={sensor} profile={profileForSensor(sensor)} reason={whyText} />
                ))}
              </div>
            </section>
          )}
          <section aria-labelledby="recipe-results" className="mt-10">
            <h2 id="recipe-results" className="text-heading font-semibold">추천 레시피</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {results.map((result) => <RecipeCard key={result.entry.id} recipe={result.entry} matchedKeywords={result.matchedKeywords} fuzzy={result.via === 'fuzzy'} />)}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
