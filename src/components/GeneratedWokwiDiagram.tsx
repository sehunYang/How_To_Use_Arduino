import { createElement, useMemo } from 'react'
import '@wokwi/elements/dist/esm/arduino-uno-element.js'
import '@wokwi/elements/dist/esm/buzzer-element.js'
import '@wokwi/elements/dist/esm/hc-sr04-element.js'
import '@wokwi/elements/dist/esm/lcd1602-element.js'
import '@wokwi/elements/dist/esm/led-element.js'
import '@wokwi/elements/dist/esm/mpu6050-element.js'
import '@wokwi/elements/dist/esm/pir-motion-sensor-element.js'
import '@wokwi/elements/dist/esm/potentiometer-element.js'
import '@wokwi/elements/dist/esm/resistor-element.js'
import '@wokwi/elements/dist/esm/servo-element.js'
import '@wokwi/elements/dist/esm/slide-potentiometer-element.js'
import { sensors } from '@/data/inventory-seed/sensors'
import type { Recipe } from '@/schema'
import { buildDiagram, planBreadboardWiring, type Diagram, type DiagramPart } from '@/wokwi/buildDiagram'
import { geometryFor } from '@/wokwi/partGeometry'
import { HalfBreadboardPart, Ina219Part, Tca9548aPart, Tsl2591Part } from './wokwiParts'
import { Bme280Visual, CdsVisual, To92Visual } from './SensorVisual'

interface Point {
  x: number
  y: number
}

interface PositionedPart extends DiagramPart {
  width: number
  height: number
}

interface ElementWithPins extends HTMLElement {
  pinInfo?: Array<{ name: string; x: number; y: number }>
}

const NATIVE_PARTS = new Set([
  'wokwi-arduino-uno',
  'wokwi-buzzer',
  'wokwi-hc-sr04',
  'wokwi-lcd1602',
  'wokwi-led',
  'wokwi-mpu6050',
  'wokwi-pir-motion-sensor',
  'wokwi-potentiometer',
  'wokwi-resistor',
  'wokwi-servo',
  'wokwi-slide-potentiometer',
])

const PART_SIZE: Record<string, { width: number; height: number }> = {
  'wokwi-hc-sr04': { width: 170.08, height: 94.49 },
  'wokwi-lcd1602': { width: 190, height: 95 },
  'wokwi-led': { width: 42, height: 48 },
  'wokwi-buzzer': { width: 64.25, height: 75.59 },
  'wokwi-pir-motion-sensor': { width: 90.71, height: 92.4 },
  'wokwi-potentiometer': { width: 75.59, height: 75.59 },
  'wokwi-resistor': { width: 96, height: 38 },
  'wokwi-servo': { width: 170.08, height: 119.55 },
  'wokwi-slide-potentiometer': { width: 150, height: 109.61 },
}

const GEOMETRY_TYPE: Record<string, string> = {
  'chip-ina219': 'visual-ina219',
  'chip-tsl2591': 'visual-tsl2591',
  'chip-bme280': 'visual-bme280',
  'visual-cds': 'visual-cds',
  'wokwi-ds18b20': 'visual-ds18b20',
  'custom-tca9548a': 'visual-tca9548a',
}

function displayName(part: DiagramPart): string {
  if (part.type === 'wokwi-resistor') {
    if (part.id.startsWith('cds_resistor')) return '10 kΩ'
    if (part.id === 'load' || part.id === 'lamp') return '220 Ω'
  }
  return part.id.replaceAll('-', ' ').replaceAll('_', ' ').toUpperCase()
}

function geometryType(part: Pick<DiagramPart, 'id' | 'type'>): string {
  if (part.type === 'wokwi-potentiometer' && part.id.startsWith('hbe0704')) {
    return 'visual-hbe0704'
  }
  return GEOMETRY_TYPE[part.type] ?? part.type
}

function verifiedGeometry(part: Pick<DiagramPart, 'id' | 'type'>) {
  return geometryFor(geometryType(part))
}

function sizeFor(part: Pick<DiagramPart, 'id' | 'type'>): { width: number; height: number } {
  const geometry = verifiedGeometry(part)
  if (geometry) return { width: geometry.width, height: geometry.height }
  return PART_SIZE[part.type] ?? { width: 132, height: 82 }
}

function normalizedPin(type: string, pin: string): string {
  if (type === 'wokwi-arduino-uno') {
    if (pin === 'GND') return 'GND.2'
    const digital = /^D(\d+)$/.exec(pin)
    if (digital) return digital[1]
  }
  if ((type === 'chip-tsl2591' || type === 'custom-tca9548a') && pin === 'VCC') return 'VIN'
  return pin
}

function nativePin(type: string, pin: string): Point | null {
  if (typeof document === 'undefined' || !NATIVE_PARTS.has(type)) return null
  const element = document.createElement(type) as ElementWithPins
  const match = element.pinInfo?.find((candidate) => candidate.name === normalizedPin(type, pin))
  return match ? { x: match.x, y: match.y } : null
}

function localPinPoint(part: PositionedPart, pin: string, pins: string[]): Point {
  const normalized = normalizedPin(part.type, pin)
  const measured = verifiedPinPoint(part, normalized)
  if (measured) return measured

  const index = Math.max(0, pins.indexOf(pin))
  return {
    x: 0,
    y: 14 + ((index + 1) * (part.height - 28)) / (pins.length + 1),
  }
}

function verifiedPinPoint(part: Pick<DiagramPart, 'id' | 'type'>, pin: string): Point | null {
  const geometry = verifiedGeometry(part)
  return geometry?.pins.find((candidate) => candidate.name === pin) ?? nativePin(part.type, pin)
}

function pinPointForEndpoint(
  endpoint: string,
  parts: Map<string, PositionedPart>,
  usages: Map<string, string[]>,
): Point {
  const [partId, pin = ''] = endpoint.split(':')
  const part = parts.get(partId)
  if (!part) throw new Error(`Generated Wokwi diagram references missing part "${partId}".`)
  const local = localPinPoint(part, pin, usages.get(partId) ?? [pin])
  return { x: part.left + local.x, y: part.top + local.y }
}

function partGraphic(part: PositionedPart) {
  if (part.type === 'chip-ina219') return <Ina219Part />
  if (part.type === 'chip-tsl2591') return <Tsl2591Part />
  if (part.type === 'chip-bme280') return <Bme280Visual />
  if (part.type === 'visual-cds') return <CdsVisual />
  if (part.type === 'wokwi-ds18b20') return <To92Visual label="DS18B20" />
  if (part.type === 'wokwi-potentiometer' && part.id.startsWith('hbe0704')) {
    return <To92Visual label="HBE0704" />
  }
  if (part.type === 'custom-tca9548a') return <Tca9548aPart />
  if (part.type === 'wokwi-breadboard-half') return <HalfBreadboardPart />
  if (NATIVE_PARTS.has(part.type)) {
    const resistor = part.type === 'wokwi-resistor'
    return createElement(part.type, {
      style: {
        width: resistor ? '78%' : '100%',
        height: resistor ? '72%' : '100%',
        margin: resistor ? '5px auto' : undefined,
        display: 'block',
        overflow: 'visible',
      },
      ...(resistor ? { value: part.id.startsWith('cds_resistor') ? '10k' : '220' } : {}),
    })
  }
  return (
    <div className="grid size-full place-items-center rounded-lg border-2 border-border bg-foreground p-2 text-center text-xs font-bold text-background">
      {displayName(part)}
    </div>
  )
}

function positionParts(parts: DiagramPart[]): PositionedPart[] {
  let componentSlot = 0
  return parts.map((part, index) => {
    const size = sizeFor(part)
    if (index === 0) return { ...part, left: 32, top: 64, ...size }
    if (part.id === 'bb') return { ...part, left: 360, top: 38, ...size }
    const slot = componentSlot++
    return {
      ...part,
      left: 350 + (slot % 3) * 180,
      top: 285 + Math.floor(slot / 3) * 190,
      ...size,
    }
  })
}

function pinUsages(diagram: Diagram): Map<string, string[]> {
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
}

function escapePoints(point: Point, part: PositionedPart): Point[] {
  const distances = [
    { edge: 'left', value: Math.abs(point.x - part.left) },
    { edge: 'right', value: Math.abs(point.x - (part.left + part.width)) },
    { edge: 'top', value: Math.abs(point.y - part.top) },
    { edge: 'bottom', value: Math.abs(point.y - (part.top + part.height)) },
  ] as const
  const edge = [...distances].sort((a, b) => a.value - b.value)[0].edge
  if (edge === 'left') return [{ x: part.left - 14, y: point.y }]
  if (edge === 'right') return [{ x: part.left + part.width + 14, y: point.y }]
  if (edge === 'top') {
    return [
      { x: point.x, y: part.top - 14 },
      { x: part.left - 14, y: part.top - 14 },
    ]
  }
  return [
    { x: point.x, y: part.top + part.height + 14 },
    { x: part.left - 14, y: part.top + part.height + 14 },
  ]
}

export function GeneratedWokwiDiagram({
  recipe,
  activeStep,
}: {
  recipe: Recipe
  activeStep: number
}) {
  const diagram = useMemo(() => buildDiagram(recipe, sensors), [recipe])
  const plannedWiring = useMemo(() => planBreadboardWiring(recipe), [recipe])
  const positioned = useMemo(() => positionParts(diagram.parts), [diagram.parts])
  const partMap = useMemo(() => new Map(positioned.map((part) => [part.id, part])), [positioned])
  const usages = useMemo(() => pinUsages(diagram), [diagram])
  const contentBottom = Math.max(290, ...positioned.map((part) => part.top + part.height + 24))
  const height = contentBottom + diagram.connections.length * 10 + 30
  const visibleCount = plannedWiring.filter((connection) => connection.stepIndex <= activeStep).length
  const currentCount = plannedWiring.filter((connection) => connection.stepIndex === activeStep).length
  const visible = diagram.connections.slice(0, visibleCount)
  const wires = visible.map(([from, to, color], index) => {
    const start = pinPointForEndpoint(from, partMap, usages)
    const end = pinPointForEndpoint(to, partMap, usages)
    const startPart = partMap.get(from.split(':')[0])!
    const endPart = partMap.get(to.split(':')[0])!
    const startEscape = escapePoints(start, startPart)
    const endEscape = escapePoints(end, endPart)
    const startCorridor = startEscape.at(-1)!
    const endCorridor = endEscape.at(-1)!
    const laneY = contentBottom + 10 + index * 10
    const route = [
      start,
      ...startEscape,
      { x: startCorridor.x, y: laneY },
      { x: endCorridor.x, y: laneY },
      ...[...endEscape].reverse(),
      end,
    ]
    const points = route.map((point) => `${point.x},${point.y}`).join(' ')
    const current = index >= visible.length - currentCount
    return (
      <g
        key={`${from}-${to}-${index}`}
        data-wire-id={`wire-${index}`}
        data-wire-current={current ? 'true' : 'false'}
        data-wire-from-pin={from}
        data-wire-to-pin={to}
        data-wire-from={`${start.x},${start.y}`}
        data-wire-to={`${end.x},${end.y}`}
        opacity={current ? 1 : 0.58}
      >
        {current && (
          <animate
            data-wire-blink
            attributeName="opacity"
            values="1;0.22;1"
            dur="3s"
            repeatCount="indefinite"
          />
        )}
        {current && <polyline data-wire-halo points={points} stroke="#fff" strokeWidth="4.5" />}
        <polyline data-wire-line points={points} stroke={color} strokeWidth={current ? 2.5 : 2} />
        <title>{`${from} → ${to}`}</title>
      </g>
    )
  })

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
        <g
          key={part.id}
          data-part-id={part.id}
          data-part-type={part.type}
          data-part-left={part.left}
          data-part-top={part.top}
          data-part-width={part.width}
          data-part-height={part.height}
        >
          <foreignObject x={part.left} y={part.top} width={part.width} height={part.height}>
            <div className="size-full">{partGraphic(part)}</div>
          </foreignObject>
        </g>
      ))}
      <g data-wire-layer="above-boards" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {wires}
      </g>
      {positioned.map((part) => (
        <g key={part.id} data-part-overlay={part.id}>
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
          {(usages.get(part.id) ?? []).map((pin) => {
            const point = pinPointForEndpoint(`${part.id}:${pin}`, partMap, usages)
            const source = verifiedPinPoint(part, normalizedPin(part.type, pin))
              ? 'verified'
              : 'fallback'
            return (
              <g
                key={pin}
                data-pin={`${part.id}:${pin}`}
                data-pin-x={point.x}
                data-pin-y={point.y}
                data-pin-source={source}
              >
                <circle cx={point.x} cy={point.y} r="3.5" fill="#fff" stroke="#172033" strokeWidth="1.5" />
                {!NATIVE_PARTS.has(part.type) && (
                  <text
                    x={point.x + 7}
                    y={point.y + 3}
                    fontSize="9"
                    fill="#172033"
                    stroke="#fff"
                    strokeWidth="3"
                    paintOrder="stroke"
                  >
                    {normalizedPin(part.type, pin)}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      ))}
    </svg>
  )
}
