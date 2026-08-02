import { Link } from 'react-router-dom'
import type { Sensor } from '@/schema'
import type { SensorProfile } from '@/data/sensorProfiles'
import { SensorVisual } from './SensorVisual'

export function SensorCard({
  sensor,
  profile,
  reason,
}: {
  sensor: Sensor
  profile: SensorProfile
  reason?: string
}) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-card border border-border bg-background shadow-sm">
      <div className="aspect-[4/3] overflow-hidden bg-muted-background p-2">
        <SensorVisual sensorId={sensor.id} />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-caption font-semibold text-accent">{profile.quantities.join(' · ')}</p>
        <h3 className="mt-1 text-heading font-semibold">{sensor.name}</h3>
        <p className="mt-2 text-body text-muted">{profile.summary}</p>
        {reason && (
          <div className="mt-4 rounded-card bg-muted-background p-3">
            <p className="text-caption font-semibold">추천 이유</p>
            <p className="mt-1 text-caption text-muted">{reason}</p>
          </div>
        )}
        {/* 링크만 모아 훑을 때 어느 센서로 가는 링크인지 가릴 수 있어야 합니다. */}
        <Link
          className="mt-auto pt-5 font-semibold text-accent hover:underline"
          to={`/sensors/${sensor.id}`}
          aria-label={`${sensor.name} 센서 자세히 보기`}
        >
          센서 자세히 보기 →
        </Link>
      </div>
    </article>
  )
}
