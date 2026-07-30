import { useEffect, useState } from 'react'
import type { AdminServices, DashboardStats } from '@/admin/AdminServices'
import { Panel } from '@/admin/AdminFields'

export function AdminDashboardPage({ services }: { services: AdminServices }) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void services.loadDashboardStats().then(setStats).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : '대시보드 통계를 불러오지 못했습니다.')
    })
  }, [services])

  if (error) return <p role="alert" className="rounded-card bg-danger-background p-4 text-danger">{error}</p>
  if (!stats) return <p role="status">대시보드를 불러오는 중…</p>

  return (
    <div className="space-y-6">
    <Panel title="레시피별 학습 현황">
      <div className="overflow-x-auto">
        <table className="w-full min-w-screen text-left">
          <thead className="bg-muted-background">
            <tr>
              <th className="p-3">레시피</th>
              <th className="p-3">시작</th>
              <th className="p-3">완료</th>
              <th className="p-3">완료율</th>
              <th className="p-3">단계별 중도 이탈</th>
            </tr>
          </thead>
          <tbody>
            {stats.rows.map((row) => {
              const completionRate = row.stats.started === 0 ? 0 : Math.round((row.stats.completed / row.stats.started) * 100)
              const dropouts = Object.entries(row.stats.dropAtStep).sort(([left], [right]) => Number(left) - Number(right))
              return (
                <tr key={row.recipeId} className="border-t border-border align-top">
                  <th className="p-3">
                    {row.title ?? row.recipeId}
                    {row.title && <span className="block text-caption font-normal text-muted">{row.recipeId}</span>}
                  </th>
                  <td className="p-3">{row.stats.started}</td>
                  <td className="p-3">{row.stats.completed}</td>
                  <td className="p-3">{completionRate}%</td>
                  <td className="p-3">
                    {dropouts.length > 0
                      ? <ul>{dropouts.map(([step, count]) => <li key={step}>{Number(step) + 1}단계: {count}명</li>)}</ul>
                      : <span className="text-muted">없음</span>}
                  </td>
                </tr>
              )
            })}
            {stats.rows.length === 0 && <tr><td className="p-6 text-center text-muted" colSpan={5}>집계된 학습 데이터가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </Panel>
    <Panel title="검색 결과가 부족했던 단어">
      {stats.failedTokens.length > 0 ? (
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stats.failedTokens.map(({ token, count }) => (
            <li key={token} className="flex justify-between rounded-card bg-muted-background p-3">
              <span>{token}</span>
              <strong>{count}회</strong>
            </li>
          ))}
        </ol>
      ) : <p className="text-muted">집계된 실패 검색 단어가 없습니다.</p>}
    </Panel>
    </div>
  )
}
