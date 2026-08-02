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

  /**
   * 그냥 굴린 휠은 페이지를 넘기게 두고, Ctrl(⌘)을 누른 채 굴렸을 때만 확대합니다.
   *
   * 배선도는 화면 위쪽에 붙어 있고 화면의 절반 넘게 차지합니다. 휠을 모두 가로채면
   * 학생이 화면 한가운데 마우스를 둔 채 아래로 굴려도 페이지가 꿈쩍하지 않고, 이미
   * 100%인 배선도는 더 줄지도 않아 아무 일도 일어나지 않습니다. 트랙패드 손가락 확대는
   * 브라우저가 ctrlKey를 켜서 보내므로 이 조건에 그대로 들어옵니다.
   */
  wheelZoom.current = (event) => {
    if (!event.ctrlKey && !event.metaKey) return
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

  /**
   * 화면 낭독기에는 그림 대신 이 문장이 읽힙니다. 지금 이어야 할 두 핀과 점퍼선 색을
   * 담아, 그림을 볼 수 없어도 이번 단계에 무엇을 해야 하는지 알 수 있게 합니다.
   */
  const panHintId = `wiring-pan-hint-${recipe.id}`
  const step = recipe.wiring[activeStep]
  const stepDescription = step
    ? ` 지금은 ${activeStep + 1}단계로, ${step.from}과(와) ${step.to}을(를) ${step.color} 점퍼선으로 잇습니다.`
    : ''

  return (
    /*
     * 배선도가 화면 높이의 절반을 넘지 않게 묶습니다. 화면 위에 붙어 있어서, 가로 폭만
     * 따라가면 넓은 화면일수록 세로로도 커져 단계 문장이 설 자리가 없어집니다.
     * 높이를 직접 자르면 그림이 가운데만 남고 양옆에 빈 띠가 생기므로, 비율은 그대로 두고
     * 가로 폭을 묶어 상자째 줄입니다.
     */
    <figure className="relative mx-auto max-w-[calc(55svh*2/3)] overflow-hidden rounded-card border border-border bg-muted-background lg:max-w-[calc(55svh*16/9)]">
      <p id={panHintId} className="sr-only">
        {recipe.title} 배선도.{stepDescription} Ctrl(⌘)을 누른 채 휠을 굴리거나 두 손가락으로 최대 500%까지 확대할 수
        있습니다. 키보드로는 더하기·빼기로 확대와 축소, 0으로 원래 크기, 확대한 뒤에는 화살표로 이동합니다.
      </p>
      <div
        ref={viewport}
        data-testid="wiring-viewport"
        tabIndex={0}
        aria-describedby={panHintId}
        className={`relative aspect-[2/3] touch-none select-none lg:aspect-[16/9] ${view.scale > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
        /*
         * 확대는 단추로 할 수 있지만 옮기기는 끌기뿐이었습니다. 키보드만 쓰는 학생은
         * 500%까지 키운 뒤 가운데밖에 볼 수 없어, 확대 자체가 쓸모없어집니다.
         */
        onKeyDown={(event) => {
          const step = event.shiftKey ? 80 : 24
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [step, 0],
            ArrowRight: [-step, 0],
            ArrowUp: [0, step],
            ArrowDown: [0, -step],
          }
          const move = moves[event.key]
          if (move && viewRef.current.scale > 1) {
            event.preventDefault()
            commitView({ ...viewRef.current, x: viewRef.current.x + move[0], y: viewRef.current.y + move[1] })
            return
          }
          if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt(viewRef.current.scale + 0.5) }
          if (event.key === '-' || event.key === '_') { event.preventDefault(); zoomAt(viewRef.current.scale - 0.5) }
          if (event.key === '0') { event.preventDefault(); commitView({ scale: 1, x: 0, y: 0 }) }
        }}
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
            <span className="text-micro leading-tight">Ctrl(⌘)+휠·핀치로 최대 500% 확대 · 드래그 또는 화살표로 이동</span>
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
