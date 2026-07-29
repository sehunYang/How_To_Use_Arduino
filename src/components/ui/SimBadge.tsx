import type { SimStatus } from '@/schema'
import { computeVerifyHash } from '@/lib/verifyHash'

export function SimBadge({
  status,
  recipe,
  inventoryVersion,
}: {
  status?: SimStatus | null
  recipe: { sketch: string; wiring: unknown; tunables: unknown; baudRate: number }
  inventoryVersion: string
}) {
  const hashMatches = status?.verifyHash === computeVerifyHash({ ...recipe, inventoryVersion })
  const verified = hashMatches && status?.compilePass === true && status.simPass === true && status.logicPass === true
  return (
    <span
      className={`rounded-full px-3 py-1 text-caption font-semibold ${verified ? 'bg-success-background text-success' : 'bg-muted-background text-muted'}`}
      aria-label={verified ? '시뮬레이션 검증됨' : '시뮬레이션 미검증'}
    >
      {verified ? '✓ 시뮬레이션 검증됨' : '○ 미검증'}
    </span>
  )
}
