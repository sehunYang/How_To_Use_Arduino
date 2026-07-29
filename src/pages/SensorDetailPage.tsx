import { Link, useParams } from 'react-router-dom'
import { RecipeCard } from '@/components/RecipeCard'
import { SensorVisual } from '@/components/SensorVisual'
import { sensors } from '@/data/inventory-seed/sensors'
import { sensorProfileById } from '@/data/sensorProfiles'
import { publishedRecipes } from '@/data/studentCatalog'

const interfaceLabels: Record<string, string> = {
  i2c: 'I2C 디지털 통신',
  analog: '아날로그 전압',
  digital: '디지털 신호',
  onewire: '1-Wire 디지털 통신',
}

function addressingText(sensor: typeof sensors[number]) {
  if (sensor.addressing.mode === 'none') return '주소를 사용하지 않음'
  if (sensor.addressing.mode === 'onewire') return `고유 1-Wire 주소 · 한 버스 최대 ${sensor.addressing.maxOnBus}개`
  return `${sensor.addressing.addresses.join(', ')} · 한 버스 최대 ${sensor.addressing.maxOnBus}개`
}

export function SensorDetailPage() {
  const { id } = useParams()
  const sensor = sensors.find((entry) => entry.id === id)
  const profile = id ? sensorProfileById.get(id) : undefined
  if (!sensor || !profile) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-3xl font-semibold">센서 정보를 찾을 수 없어요</h1>
        <Link className="mt-4 inline-block text-accent" to="/sensors">센서 목록으로 돌아가기</Link>
      </div>
    )
  }

  const recipes = publishedRecipes.filter((recipe) => recipe.sensors.includes(sensor.id))
  return (
    <article className="mx-auto max-w-6xl">
      <Link to="/sensors" className="text-caption text-accent hover:underline">← 센서 목록</Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="aspect-[4/3] overflow-hidden rounded-card border border-border bg-muted-background p-8">
          <SensorVisual sensorId={sensor.id} />
        </div>
        <div>
          <p className="text-caption font-semibold text-accent">{profile.quantities.join(' · ')}</p>
          <h1 className="mt-1 text-4xl font-semibold">{sensor.name}</h1>
          <p className="mt-4 text-body text-muted">{profile.summary}</p>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-card border border-border p-4"><dt className="text-caption text-muted">출력값</dt><dd className="mt-1 font-medium">{profile.output}</dd></div>
            <div className="rounded-card border border-border p-4"><dt className="text-caption text-muted">인터페이스</dt><dd className="mt-1 font-medium">{interfaceLabels[sensor.interface]}</dd></div>
            <div className="rounded-card border border-border p-4"><dt className="text-caption text-muted">주소·연결 수</dt><dd className="mt-1 font-medium">{addressingText(sensor)}</dd></div>
            <div className="rounded-card border border-border p-4"><dt className="text-caption text-muted">대표 소비전류</dt><dd className="mt-1 font-medium">{sensor.currentDrawMa}mA</dd></div>
          </dl>
        </div>
      </div>

      <section className="mt-10" aria-labelledby="sensor-specs">
        <h2 id="sensor-specs" className="text-heading font-semibold">구체적인 스펙</h2>
        <div className="mt-4 overflow-hidden rounded-card border border-border">
          <table className="w-full text-left">
            <tbody>
              {profile.specs.map((spec) => <tr key={spec.label} className="border-b border-border last:border-0"><th className="w-40 bg-muted-background p-4 align-top">{spec.label}</th><td className="p-4">{spec.value}</td></tr>)}
              <tr className="border-b border-border"><th className="bg-muted-background p-4 align-top">핀 구성</th><td className="p-4">{sensor.pins.map((pin) => `${pin.name}(${pin.kind})`).join(', ')}</td></tr>
              <tr><th className="bg-muted-background p-4 align-top">Wokwi 상태</th><td className="p-4">{sensor.wokwi.simSupported ? '시뮬레이션 지원' : '현재 실물 배선 학습 중심'}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="rounded-card border border-border p-5" aria-labelledby="recommended-experiments">
          <h2 id="recommended-experiments" className="text-heading font-semibold">추천 실험</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">{profile.experiments.map((experiment) => <li key={experiment}>{experiment}</li>)}</ul>
        </section>
        <section className="rounded-card border border-border p-5" aria-labelledby="sensor-cautions">
          <h2 id="sensor-cautions" className="text-heading font-semibold">사용할 때 확인할 점</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">{profile.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul>
        </section>
      </div>

      <section className="mt-10" aria-labelledby="related-recipes">
        <h2 id="related-recipes" className="text-heading font-semibold">이 센서를 사용하는 레시피</h2>
        {recipes.length > 0
          ? <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{recipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}</div>
          : <p className="mt-3 rounded-card border border-border p-5 text-muted">현재 공개된 레시피를 준비하고 있습니다. 위 추천 실험을 새 탐구 아이디어로 활용해보세요.</p>}
      </section>
    </article>
  )
}
