import { createElement, useMemo } from 'react'
import '@wokwi/elements/dist/esm/arduino-uno-element.js'
import '@wokwi/elements/dist/esm/buzzer-element.js'
import '@wokwi/elements/dist/esm/hc-sr04-element.js'
import '@wokwi/elements/dist/esm/lcd1602-element.js'
import '@wokwi/elements/dist/esm/led-element.js'
import '@wokwi/elements/dist/esm/mpu6050-element.js'
import '@wokwi/elements/dist/esm/photoresistor-sensor-element.js'
import '@wokwi/elements/dist/esm/pir-motion-sensor-element.js'
import '@wokwi/elements/dist/esm/potentiometer-element.js'
import '@wokwi/elements/dist/esm/resistor-element.js'
import '@wokwi/elements/dist/esm/servo-element.js'
import '@wokwi/elements/dist/esm/slide-potentiometer-element.js'
import { sensors } from '@/data/inventory-seed/sensors'
import type { Recipe } from '@/schema'
import { buildDiagram, type DiagramPart } from '@/wokwi/buildDiagram'
import { Ina219Part, Tca9548aPart, Tsl2591Part } from './wokwiParts'

interface PositionedPart extends DiagramPart {
  width: number
  height: number
}

const NATIVE_PARTS = new Set([
  'wokwi-arduino-uno',
  'wokwi-buzzer',
  'wokwi-hc-sr04',
  'wokwi-lcd1602',
  'wokwi-led',
  'wokwi-mpu6050',
  'wokwi-photoresistor-sensor',
  'wokwi-pir-motion-sensor',
  'wokwi-potentiometer',
  'wokwi-resistor',
  'wokwi-servo',
  'wokwi-slide-potentiometer',
])

const PART_SIZE: Record<string, { width: number; height: number }> = {
  'wokwi-arduino-uno': { width: 274, height: 202 },
  'wokwi-hc-sr04': { width: 170, height: 95 },
  'wokwi-lcd1602': { width: 190, height: 95 },
  'wokwi-mpu6050': { width: 112, height: 84 },
  'wokwi-photoresistor-sensor': { width: 174, height: 62 },
  'wokwi-pir-motion-sensor': { width: 92, height: 94 },
  'wokwi-potentiometer': { width: 76, height: 76 },
  'wokwi-resistor': { width: 118, height: 28 },
  'wokwi-servo': { width: 170, height: 120 },
  'wokwi-slide-potentiometer': { width: 150, height: 110 },
  'chip-ina219': { width: 140, height: 92 },
  'chip-tsl2591': { width: 140, height: 92 },
  'custom-tca9548a': { width: 180, height: 106 },
}

function displayName(part: DiagramPart): string {
  return part.id.replaceAll('-', ' ').replaceAll('_', ' ').toUpperCase()
}

function partGraphic(part: PositionedPart) {
  if (part.type === 'chip-ina219') return <Ina219Part />
  if (part.type === 'chip-tsl2591') return <Tsl2591Part />
  if (part.type === 'custom-tca9548a') return <Tca9548aPart />
  if (NATIVE_PARTS.has(part.type)) {
    return createElement(part.type, {
      style: { width: '100%', height: '100%', display: 'block' },
    })
  }
  return (
    <div className="grid size-full place-items-center rounded-lg border-2 border-border bg-foreground p-2 text-center text-xs font-bold text-background">
      {displayName(part)}
    </div>
  )
}

function positionParts(parts: DiagramPart[]): PositionedPart[] {
  return parts.map((part, index) => {
    const size = PART_SIZE[part.type] ?? { width: 132, height: 82 }
    if (index === 0) return { ...part, left: 32, top: 64, ...size }
    const slot = index - 1
    return {
      ...part,
      left: 390 + (slot % 2) * 245,
      top: 38 + Math.floor(slot / 2) * 165,
      ...size,
    }
  })
}

function endpointPoint(
  endpoint: string,
  otherEndpoint: string,
  parts: Map<string, PositionedPart>,
  usages: Map<string, string[]>,
): { x: number; y: number } {
  const [partId, pin = ''] = endpoint.split(':')
  const [otherPartId] = otherEndpoint.split(':')
  const part = parts.get(partId)!
  const other = parts.get(otherPartId)!
  const pins = usages.get(partId) ?? [pin]
  const pinIndex = Math.max(0, pins.indexOf(pin))
  const y = part.top + 18 + ((pinIndex + 1) * (part.height - 36)) / (pins.length + 1)
  return {
    x: other.left >= part.left ? part.left + part.width : part.left,
    y,
  }
}

export function GeneratedWokwiDiagram({
  recipe,
  activeStep,
}: {
  recipe: Recipe
  activeStep: number
}) {
  const diagram = useMemo(() => buildDiagram(recipe, sensors), [recipe])
  const positioned = useMemo(() => positionParts(diagram.parts), [diagram.parts])
  const partMap = useMemo(() => new Map(positioned.map((part) => [part.id, part])), [positioned])
  const usages = useMemo(() => {
    const result = new Map<string, string[]>()
    for (const [from, to] of diagram.connections) {
      for (const endpoint of [from, to]) {
        const [partId, pin = ''] = endpoint.split(':')
        const current = result.get(partId) ?? []
        if (!current.includes(pin)) current.push(pin)
        result.set(partId, current)
      }
    }
    return result
  }, [diagram.connections])
  const height = Math.max(330, ...positioned.map((part) => part.top + part.height + 40))
  const visible = diagram.connections.slice(0, activeStep + 1)

  return (
    <svg
      viewBox={`0 0 900 ${height}`}
      role="img"
      aria-label={`${recipe.title} Wokwi 배선도 ${activeStep + 1}단계까지 연결됨`}
      className="size-full"
      preserveAspectRatio="xMidYMid meet"
      data-generated-wokwi-diagram={recipe.id}
    >
      <rect width="900" height={height} rx="14" fill="#f7f7f5" />
      {positioned.map((part) => (
        <g key={part.id} data-part-id={part.id}>
          <foreignObject x={part.left} y={part.top} width={part.width} height={part.height}>
            <div className="size-full">{partGraphic(part)}</div>
          </foreignObject>
          <text
            x={part.left + part.width / 2}
            y={part.top + part.height + 16}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="#334155"
          >
            {displayName(part)}
          </text>
        </g>
      ))}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {visible.map(([from, to, color], index) => {
          const start = endpointPoint(from, to, partMap, usages)
          const end = endpointPoint(to, from, partMap, usages)
          const laneX = start.x + (end.x - start.x) * (0.42 + (index % 4) * 0.04)
          const points = `${start.x},${start.y} ${laneX},${start.y} ${laneX},${end.y} ${end.x},${end.y}`
          const current = index === visible.length - 1
          return (
            <g key={`${from}-${to}-${index}`} data-wire-id={`wire-${index}`} opacity={current ? 1 : 0.58}>
              {current && <polyline points={points} stroke="#fff" strokeWidth="9" />}
              <polyline points={points} stroke={color} strokeWidth={current ? 5 : 4} />
              <title>{`${from} → ${to}`}</title>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
