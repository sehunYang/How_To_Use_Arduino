import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Recipe } from '@/schema'
import { layoutForRecipe } from '@/wokwi/layoutRegistry'
import { validateReadableLayout } from '@/wokwi/readableLayout'
import { CircuitDiagram } from './CircuitDiagram'
import { GeneratedWokwiDiagram } from './GeneratedWokwiDiagram'

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
  const viewport = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const viewRef = useRef(view)
  const wheelZoom = useRef<(event: WheelEvent) => void>(() => undefined)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; midpoint: { x: number; y: number } } | null>(null)

  function commitView(next: { scale: number; x: number; y: number }) {
    const element = viewport.current
    const scale = Math.min(5, Math.max(1, next.scale))
    if (scale === 1 || !element) {
      const reset = { scale, x: 0, y: 0 }
      viewRef.current = reset
      setView(reset)
      return
    }

    const bounds = element.getBoundingClientRect()
    const clamped = {
      scale,
      x: Math.min(bounds.width * (scale - 1) / 2, Math.max(-bounds.width * (scale - 1) / 2, next.x)),
      y: Math.min(bounds.height * (scale - 1) / 2, Math.max(-bounds.height * (scale - 1) / 2, next.y)),
    }
    viewRef.current = clamped
    setView(clamped)
  }

  function zoomAt(nextScale: number, clientX?: number, clientY?: number) {
    const element = viewport.current
    const current = viewRef.current
    const scale = Math.min(5, Math.max(1, nextScale))
    if (!element || clientX === undefined || clientY === undefined) {
      commitView({ ...current, scale })
      return
    }

    const bounds = element.getBoundingClientRect()
    const focalX = clientX - bounds.left - bounds.width / 2
    const focalY = clientY - bounds.top - bounds.height / 2
    const ratio = scale / current.scale
    commitView({
      scale,
      x: focalX - (focalX - current.x) * ratio,
      y: focalY - (focalY - current.y) * ratio,
    })
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const points = [...pointers.current.values()]
    if (points.length === 2) {
      const nextDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
      const midpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
      if (pinch.current) {
        const current = viewRef.current
        const ratio = nextDistance / pinch.current.distance
        const bounds = viewport.current!.getBoundingClientRect()
        const previousX = pinch.current.midpoint.x - bounds.left - bounds.width / 2
        const previousY = pinch.current.midpoint.y - bounds.top - bounds.height / 2
        const nextX = midpoint.x - bounds.left - bounds.width / 2
        const nextY = midpoint.y - bounds.top - bounds.height / 2
        commitView({
          scale: current.scale * ratio,
          x: nextX - (previousX - current.x) * ratio,
          y: nextY - (previousY - current.y) * ratio,
        })
      }
      pinch.current = { distance: nextDistance, midpoint }
    } else if (points.length === 1 && viewRef.current.scale > 1) {
      const current = viewRef.current
      commitView({
        ...current,
        x: current.x + event.clientX - previous.x,
        y: current.y + event.clientY - previous.y,
      })
    }
  }

  function releasePointer(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }

  wheelZoom.current = (event) => {
    event.preventDefault()
    event.stopPropagation()
    zoomAt(viewRef.current.scale * Math.exp(-event.deltaY * 0.002), event.clientX, event.clientY)
  }

  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const handleWheel = (event: WheelEvent) => wheelZoom.current(event)
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [])

  return (
    <figure className="relative overflow-hidden rounded-card border border-border bg-muted-background">
      <div
        ref={viewport}
        data-testid="wiring-viewport"
        className={`relative aspect-[4/3] touch-none select-none ${view.scale > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
        aria-label={`${recipe.title} 완성 배선도. 마우스 휠 또는 두 손가락으로 최대 500%까지 확대하고, 확대 후 드래그해 이동할 수 있습니다.`}
        onDoubleClick={(event) => viewRef.current.scale > 1
          ? commitView({ scale: 1, x: 0, y: 0 })
          : zoomAt(2, event.clientX, event.clientY)}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
          const points = [...pointers.current.values()]
          if (points.length === 2) {
            pinch.current = {
              distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
              midpoint: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
            }
          }
        }}
        onPointerMove={onPointerMove}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
      >
        <div
          data-testid="wiring-canvas"
          className="absolute inset-0 origin-center"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          {layout ? (
            <CircuitDiagram layout={layout} activeStep={activeStep} title={recipe.title} />
          ) : (
            <GeneratedWokwiDiagram recipe={recipe} activeStep={activeStep} />
          )}
        </div>
        <figcaption
          className="absolute inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 px-4 py-2 text-caption text-muted backdrop-blur"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>휠·핀치로 최대 500% 확대 · 확대 후 드래그하여 이동</span>
            <span className="flex gap-1">
              <Button size="sm" variant="ghost" aria-label="배선도 축소" onClick={() => zoomAt(viewRef.current.scale - 0.5)}>−</Button>
              <Button size="sm" variant="ghost" aria-label="배선도 원래 크기" onClick={() => commitView({ scale: 1, x: 0, y: 0 })}>{Math.round(view.scale * 100)}%</Button>
              <Button size="sm" variant="ghost" aria-label="배선도 확대" onClick={() => zoomAt(viewRef.current.scale + 0.5)}>＋</Button>
            </span>
          </div>
        </figcaption>
      </div>
    </figure>
  )
}
