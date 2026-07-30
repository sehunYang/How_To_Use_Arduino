import { useRef, useState, type PointerEvent } from 'react'
import type { FocusRegion } from '@/schema'

type Point = { x: number; y: number }

export function FocusRegionEditor({
  imageUrl,
  naturalWidth,
  naturalHeight,
  value,
  onChange,
}: {
  imageUrl: string
  naturalWidth: number
  naturalHeight: number
  value: FocusRegion
  onChange(value: FocusRegion): void
}) {
  const image = useRef<HTMLImageElement>(null)
  const [origin, setOrigin] = useState<Point | null>(null)

  function naturalPoint(event: PointerEvent<HTMLDivElement>): Point {
    const rect = image.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 }
    return {
      x: Math.max(0, Math.min(naturalWidth, ((event.clientX - rect.left) / rect.width) * naturalWidth)),
      y: Math.max(0, Math.min(naturalHeight, ((event.clientY - rect.top) / rect.height) * naturalHeight)),
    }
  }

  function start(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = naturalPoint(event)
    setOrigin(point)
    onChange({ x: Math.round(point.x), y: Math.round(point.y), w: 1, h: 1 })
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!origin) return
    const point = naturalPoint(event)
    onChange({
      x: Math.round(Math.min(origin.x, point.x)),
      y: Math.round(Math.min(origin.y, point.y)),
      w: Math.max(1, Math.round(Math.abs(point.x - origin.x))),
      h: Math.max(1, Math.round(Math.abs(point.y - origin.y))),
    })
  }

  return (
    <div>
      <div
        className="relative touch-none overflow-hidden rounded-card border border-border bg-muted-background"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => setOrigin(null)}
        aria-label="배선 이미지에서 드래그하여 강조 영역 선택"
      >
        {imageUrl ? (
          <img ref={image} src={imageUrl} alt="배선 강조 영역 미리보기" className="block h-auto w-full select-none" draggable={false} />
        ) : (
          <div className="grid aspect-video place-items-center text-muted">강조 영역을 선택하려면 이미지를 업로드하세요.</div>
        )}
        {imageUrl && naturalWidth > 0 && naturalHeight > 0 && (
          <div
            data-testid="focus-overlay"
            className="pointer-events-none absolute border-2 border-accent bg-accent/20"
            style={{
              left: `${(value.x / naturalWidth) * 100}%`,
              top: `${(value.y / naturalHeight) * 100}%`,
              width: `${(value.w / naturalWidth) * 100}%`,
              height: `${(value.h / naturalHeight) * 100}%`,
            }}
          />
        )}
      </div>
      <p className="mt-1 text-caption text-muted" aria-live="polite">
        원본 이미지 좌표: x {value.x}, y {value.y}, 너비 {value.w}, 높이 {value.h}
      </p>
    </div>
  )
}
