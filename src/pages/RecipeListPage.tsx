import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RecipeCard } from '@/components/RecipeCard'
import { usePublishedRecipes } from '@/firebase/contentRepository'
import { useSensorInventory } from '@/firebase/sensorInventory'

type View = 'gallery' | 'table'

export function RecipeListPage() {
  const publishedRecipes = usePublishedRecipes()
  // 센서 목록의 값은 저장용 id(mpu6050)라 학생이 부품에서 읽는 이름(MPU6050)과 다릅니다.
  const sensorNames = new Map(useSensorInventory().map((entry) => [entry.id, entry.name]))
  const [view, setView] = useState<View>('gallery')
  const [subject, setSubject] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [sensor, setSensor] = useState('')
  const [sort, setSort] = useState('title')
  const filtered = Boolean(subject || difficulty || sensor)
  function clearFilters() {
    setSubject('')
    setDifficulty('')
    setSensor('')
  }
  const recipes = useMemo(() => publishedRecipes
    .filter((recipe) => !subject || recipe.subject === subject)
    .filter((recipe) => !difficulty || recipe.difficulty === difficulty)
    .filter((recipe) => !sensor || recipe.sensors.includes(sensor))
    .sort((a, b) => sort === 'minutes' ? a.minutes - b.minutes : a.title.localeCompare(b.title, 'ko')), [publishedRecipes, subject, difficulty, sensor, sort])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-caption font-semibold text-accent">레시피 데이터베이스</p><h1 className="text-3xl font-semibold">탐구 레시피 둘러보기</h1></div>
        <p className="w-full max-w-3xl text-body text-muted">
          레시피 하나에는 준비물, 단계별 배선도, 그대로 복사해 쓰는 코드, 바꿔 볼 값과 탐구 안내가 함께 들어 있습니다.
          과목·난이도·센서로 추리거나, 짧은 시간에 끝나는 것부터 살펴보세요.
        </p>
        <div className="flex rounded-card border border-border p-1" role="group" aria-label="보기 방식">
          <button className={`rounded-card px-3 py-2 ${view === 'gallery' ? 'bg-accent text-accent-foreground' : ''}`} onClick={() => setView('gallery')}>갤러리</button>
          <button className={`rounded-card px-3 py-2 ${view === 'table' ? 'bg-accent text-accent-foreground' : ''}`} onClick={() => setView('table')}>테이블</button>
        </div>
      </div>
      <div className="mt-6 grid gap-3 rounded-card border border-border p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Filter label="과목" value={subject} onChange={setSubject} options={['물리', '화학·환경', '생물', '공학·로봇']} />
        <Filter label="난이도" value={difficulty} onChange={setDifficulty} options={['초급', '중급', '고급']} />
        <Filter
          label="센서"
          value={sensor}
          onChange={setSensor}
          options={[...new Set(publishedRecipes.flatMap((recipe) => recipe.sensors))]}
          labels={Object.fromEntries(sensorNames)}
        />
        <Filter label="정렬" value={sort} onChange={setSort} options={['title', 'minutes']} labels={{ title: '이름순', minutes: '짧은 시간순' }} includeAll={false} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <p aria-live="polite" className="text-caption text-muted">{recipes.length}개의 레시피</p>
        {filtered && <Button size="sm" variant="outline" onClick={clearFilters}>필터 지우기</Button>}
      </div>
      <h2 className="sr-only">레시피 목록</h2>
      {recipes.length === 0 ? (
        <div className="mt-4 rounded-card border border-border p-8 text-center">
          <p className="font-semibold">고른 조건에 맞는 레시피가 없습니다.</p>
          <p className="mt-2 text-caption text-muted">
            조건을 하나씩 풀어 보거나, 아이디어를 문장으로 적어 검색해 보세요.
          </p>
          <Button className="mt-4" variant="outline" onClick={clearFilters}>필터 지우기</Button>
        </div>
      ) : view === 'gallery' ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{recipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}</div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-card border border-border">
          <table className="w-full min-w-2xl text-left">
            <caption className="sr-only">탐구 레시피 목록</caption>
            <thead className="bg-muted-background"><tr><th scope="col" className="p-3">이름</th><th scope="col" className="p-3">과목</th><th scope="col" className="p-3">난이도</th><th scope="col" className="p-3">센서</th><th scope="col" className="p-3">시간</th></tr></thead>
            <tbody>{recipes.map((recipe) => <tr key={recipe.id} className="border-t border-border"><th scope="row" className="p-3 text-left font-medium">{recipe.title}</th><td className="p-3">{recipe.subject ?? '융합'}</td><td className="p-3">{recipe.difficulty}</td><td className="p-3">{recipe.sensors.map((id) => sensorNames.get(id) ?? id).join(', ')}</td><td className="p-3">{recipe.minutes}분</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Filter({ label, value, onChange, options, labels = {}, includeAll = true }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string>; includeAll?: boolean }) {
  return <label className="text-caption font-medium">{label}<select className="mt-1 h-11 w-full rounded-card border border-border bg-background px-3 text-body" value={value} onChange={(event) => onChange(event.target.value)}>{includeAll && <option value="">전체</option>}{options.map((option) => <option key={option} value={option}>{labels[option] ?? option}</option>)}</select></label>
}
