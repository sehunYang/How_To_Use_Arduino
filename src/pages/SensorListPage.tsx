import { useMemo, useState } from 'react'
import { SensorCard } from '@/components/SensorCard'
import { profileForSensor } from '@/data/sensorProfiles'
import { useSensorInventory } from '@/firebase/sensorInventory'

const interfaceLabels: Record<string, string> = {
  i2c: 'I2C',
  analog: '아날로그',
  digital: '디지털',
  onewire: '1-Wire',
}

export function SensorListPage() {
  const sensors = useSensorInventory()
  const [query, setQuery] = useState('')
  const [sensorInterface, setSensorInterface] = useState('')
  const cards = useMemo(() => sensors
    .map((sensor) => ({ sensor, profile: profileForSensor(sensor) }))
        .filter(({ sensor }) => !sensorInterface || sensor.interface === sensorInterface)
    .filter(({ sensor, profile }) => {
      const normalized = query.trim().toLocaleLowerCase('ko')
      return !normalized || [sensor.name, profile.summary, ...profile.quantities]
        .join(' ')
        .toLocaleLowerCase('ko')
        .includes(normalized)
    })
    .sort((a, b) => a.sensor.name.localeCompare(b.sensor.name, 'ko')),
  [query, sensorInterface, sensors])

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-semibold">센서 학습하기</h1>
      <div className="mt-6 grid gap-3 rounded-card border border-border p-4 md:grid-cols-2">
        <label className="text-caption font-medium">
          센서·물리량 검색
          <input
            className="mt-1 h-11 w-full rounded-card border border-border bg-background px-3 text-body"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="예: 온도, 거리, 조도"
          />
        </label>
        <label className="text-caption font-medium">
          출력 인터페이스
          <select
            className="mt-1 h-11 w-full rounded-card border border-border bg-background px-3 text-body"
            value={sensorInterface}
            onChange={(event) => setSensorInterface(event.target.value)}
          >
            <option value="">전체</option>
            {Object.entries(interfaceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <p aria-live="polite" className="mt-4 text-caption text-muted">{cards.length}개의 센서·버스 부품</p>
      <h2 className="sr-only">센서 목록</h2>
      <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ sensor, profile }) => <SensorCard key={sensor.id} sensor={sensor} profile={profile} />)}
      </div>
      {cards.length === 0 && (
        <div className="mt-8 rounded-card border border-border p-8 text-center">
          <p className="font-semibold">조건에 맞는 센서가 없습니다.</p>
        </div>
      )}
    </div>
  )
}
