import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Recipe } from '@/schema'
import { layoutForRecipe } from '@/wokwi/layoutRegistry'
import { validateReadableLayout } from '@/wokwi/readableLayout'
import { CircuitDiagram } from './CircuitDiagram'

export function WiringIllustration({
  recipe,
  activeStep,
}: {
  recipe: Recipe
  activeStep: number
}) {
  const layout = useMemo(() => {
    const candidate = layoutForRecipe(recipe)
    return candidate && validateReadableLayout(candidate).length === 0 ? candidate : null
  }, [recipe])
  const [scale, setScale] = useState(1)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const distance = useRef<number | null>(null)

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const points = [...pointers.current.values()]
    if (points.length === 2) {
      const nextDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
      if (distance.current) setScale((value) => Math.min(3, Math.max(1, value * (nextDistance / distance.current!))))
      distance.current = nextDistance
    }
  }

  function releasePointer(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) distance.current = null
  }

  return (
    <figure className="relative overflow-hidden rounded-card border border-border bg-muted-background">
      <div
        className="relative aspect-[4/3] touch-none select-none"
        aria-label={`${recipe.title} 완성 배선도. 두 손가락 또는 더블 탭으로 확대할 수 있습니다.`}
        onDoubleClick={() => setScale((value) => value > 1 ? 1 : 2)}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        }}
        onPointerMove={onPointerMove}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
      >
        <div className="absolute inset-0 origin-center transition-transform" style={{ transform: `scale(${scale})` }}>
          {layout ? (
            <CircuitDiagram layout={layout} activeStep={activeStep} title={recipe.title} />
          ) : (
            <div className="grid size-full place-items-center p-8 text-center text-muted">
              검증된 배선 이미지를 준비하고 있습니다.
            </div>
          )}
        </div>
      </div>
      <figcaption className="border-t border-border px-4 py-2 text-caption text-muted">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>현재 단계까지 누적된 배선 · 밝은 선이 이번 단계의 연결입니다.</span>
          <span className="flex gap-1">
            <Button size="sm" variant="ghost" aria-label="배선도 축소" onClick={() => setScale((value) => Math.max(1, value - 0.5))}>−</Button>
            <Button size="sm" variant="ghost" aria-label="배선도 원래 크기" onClick={() => setScale(1)}>{Math.round(scale * 100)}%</Button>
            <Button size="sm" variant="ghost" aria-label="배선도 확대" onClick={() => setScale((value) => Math.min(3, value + 0.5))}>＋</Button>
          </span>
        </div>
      </figcaption>
    </figure>
  )
}
