import { createElement, useMemo } from 'react'
import '@wokwi/elements/dist/esm/arduino-uno-element.js'
import '@wokwi/elements/dist/esm/mpu6050-element.js'
import type { ReadableLayout, ReadablePart } from '@/wokwi/readableLayout'
import { geometryFor } from '@/wokwi/partGeometry'
import { HalfBreadboardPart, Ina219Part, Tsl2591Part } from './wokwiParts'

const PADDING = 24

function partGraphic(part: ReadablePart) {
  if (part.type === 'visual-ina219') return <Ina219Part />
  if (part.type === 'visual-tsl2591') return <Tsl2591Part />
  if (part.type === 'wokwi-breadboard-half') return <HalfBreadboardPart />
  if (part.type === 'wokwi-arduino-uno' || part.type === 'wokwi-mpu6050') {
    return createElement(part.type, { style: { width: '100%', height: '100%', display: 'block' } })
  }
  return null
}

export function CircuitDiagram({
  layout,
  activeStep,
  title,
}: {
  layout: ReadableLayout
  activeStep: number
  title: string
}) {
  const bounds = useMemo(() => {
    const xs = layout.wires.flatMap((wire) => wire.points.map((point) => point.x))
    const ys = layout.wires.flatMap((wire) => wire.points.map((point) => point.y))
    for (const part of layout.parts) {
      const geometry = geometryFor(part.type)
      if (!geometry) continue
      xs.push(part.left, part.left + geometry.width)
      ys.push(part.top, part.top + geometry.height)
    }
    const left = Math.min(...xs) - PADDING
    const top = Math.min(...ys) - PADDING
    const right = Math.max(...xs) + PADDING
    const bottom = Math.max(...ys) + PADDING
    return { left, top, width: right - left, height: bottom - top }
  }, [layout])

  const visibleWires = layout.wires.slice(0, activeStep + 1)

  return (
    <svg
      viewBox={`${bounds.left} ${bounds.top} ${bounds.width} ${bounds.height}`}
      role="img"
      aria-label={`${title} 배선도, ${activeStep + 1}단계까지 연결됨`}
      className="size-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={bounds.left} y={bounds.top} width={bounds.width} height={bounds.height} rx="12" fill="#f7f7f5" />
      {layout.parts.map((part) => {
        const geometry = geometryFor(part.type)
        const graphic = partGraphic(part)
        if (!geometry || !graphic) return null
        return (
          <foreignObject
            key={part.id}
            x={part.left}
            y={part.top}
            width={geometry.width}
            height={geometry.height}
            data-part-id={part.id}
          >
            <div className="size-full">{graphic}</div>
          </foreignObject>
        )
      })}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {visibleWires.map((wire, index) => {
          const points = wire.points.map((point) => `${point.x},${point.y}`).join(' ')
          const current = index === visibleWires.length - 1
          return (
            <g key={wire.id} data-wire-id={wire.id} opacity={current ? 1 : 0.58}>
              {current && <polyline points={points} stroke="#ffffff" strokeWidth="8" />}
              <polyline points={points} stroke={wire.color} strokeWidth={current ? 5 : 4} />
              {current && wire.points.map((point, pointIndex) => (
                <circle key={pointIndex} cx={point.x} cy={point.y} r="4.5" fill={wire.color} stroke="#ffffff" strokeWidth="2" />
              ))}
            </g>
          )
        })}
      </g>
    </svg>
  )
}
