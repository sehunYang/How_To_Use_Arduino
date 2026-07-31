/**
 * 논문 그림 형식의 그래프. 흰 바탕 · 검은 축 · 안쪽 눈금으로 그려서
 * 보고서에 그대로 붙여 넣을 수 있게 했습니다.
 *
 * 화면 테마(밝게/어둡게)와 상관없이 항상 흰 바탕으로 그립니다. 저장 버튼이 만드는
 * PNG는 화면에 보이는 그림을 그대로 복사한 것이라 둘이 달라지면 안 되고, 어두운 바탕
 * 그림은 인쇄물이나 보고서에 쓸 수 없기 때문입니다.
 *
 * 계열 색은 고정된 순서로만 배정합니다(파랑 → 주황 → 초록). 계열을 빼거나 더해도
 * 남은 계열의 색이 바뀌지 않아야 "파란 점이 온도"라는 기억이 계속 맞습니다.
 * 색만으로 구분하지 않도록 점 모양(원·마름모·삼각형)도 함께 다르게 그립니다.
 */
import { useCallback, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { createAxisScale, estimateTextWidth, extent } from '@/lib/chartScale'
import { formatMeasurement, type MeasurementPoint } from '@/lib/dataStats'

export const CHART_WIDTH = 760
export const CHART_HEIGHT = 470

/** 산점도는 모든 계열 쌍이 서로 구분되어야 해서 세 개까지만 함께 그립니다. */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a'] as const
export const MAX_SERIES = SERIES_COLORS.length
export const SERIES_SHAPE_NAMES = ['원', '마름모', '삼각형'] as const

const SURFACE = '#ffffff'
const INK = '#111111'
const INK_SECONDARY = '#4b4b4b'

const PLOT_LEFT = 92
const PLOT_RIGHT = CHART_WIDTH - 28
const PLOT_BOTTOM = CHART_HEIGHT - 78
const PLOT_TOP_PLAIN = 30
const PLOT_TOP_WITH_BAND = 64
const TOP_BAND_MIDDLE = 30

const TICK_LENGTH = 6
const MARKER_RADIUS = 4
/** 점(반지름)과 바탕색 테두리(2)를 합친 크기. 축 위의 점을 온전히 그리는 여백입니다. */
const MARKER_CLIP_PADDING = MARKER_RADIUS + 3
const LABEL_FONT_SIZE = 13
/**
 * 꺾은선에서 이웃한 점 사이가 이보다 좁으면 점을 그리지 않고 선만 남깁니다.
 * 점이 서로 닿을 만큼 촘촘하면 점들이 선을 덮어 산점도처럼 보이기 때문입니다.
 */
const MIN_MARKER_SPACING = 16
/** 이보다 먼 곳을 가리키면 엉뚱한 점을 설명하게 되므로 표시하지 않습니다. */
const HOVER_RADIUS = 40

export type ChartKind = 'scatter' | 'line'

export interface ChartSeries {
  key: string
  label: string
  points: readonly MeasurementPoint[]
}

export interface TrendLine {
  slope: number
  intercept: number
  /** 그래프 안에 함께 적을 회귀식과 R² 문구 */
  annotation: string
}

function SeriesMarker({ shapeIndex, x, y }: { shapeIndex: number; x: number; y: number }) {
  const fill = SERIES_COLORS[shapeIndex]
  // 겹친 점끼리도 구분되도록 바탕색 테두리를 두릅니다.
  const ring = { stroke: SURFACE, strokeWidth: 2 }

  if (shapeIndex === 0) return <circle cx={x} cy={y} r={MARKER_RADIUS} fill={fill} {...ring} />
  if (shapeIndex === 1) {
    const d = `M ${x} ${y - MARKER_RADIUS - 1} L ${x + MARKER_RADIUS + 1} ${y} L ${x} ${y + MARKER_RADIUS + 1} L ${x - MARKER_RADIUS - 1} ${y} Z`
    return <path d={d} fill={fill} {...ring} />
  }
  const d = `M ${x} ${y - MARKER_RADIUS - 1.5} L ${x + MARKER_RADIUS + 1} ${y + MARKER_RADIUS} L ${x - MARKER_RADIUS - 1} ${y + MARKER_RADIUS} Z`
  return <path d={d} fill={fill} {...ring} />
}

interface HoveredPoint {
  seriesLabel: string
  point: MeasurementPoint
  cx: number
  cy: number
}

export interface DataChartProps {
  series: readonly ChartSeries[]
  xLabel: string
  yLabel: string
  kind: ChartKind
  trendLine?: TrendLine | null
  /** 화면 낭독기가 읽어 줄 그래프 설명 */
  description: string
  /** PNG 저장 버튼이 그림을 복사할 수 있도록 SVG를 밖으로 전달합니다. */
  chartRef?: RefObject<SVGSVGElement | null>
}

export function DataChart({ series, xLabel, yLabel, kind, trendLine, description, chartRef }: DataChartProps) {
  const clipId = useId()
  const markerClipId = useId()
  const ownRef = useRef<SVGSVGElement>(null)
  const [hovered, setHovered] = useState<HoveredPoint | null>(null)

  const attachRef = useCallback(
    (node: SVGSVGElement | null) => {
      ownRef.current = node
      if (chartRef) chartRef.current = node
    },
    [chartRef],
  )

  const geometry = useMemo(() => {
    const visibleSeries = series.slice(0, MAX_SERIES)
    const showLegend = visibleSeries.length > 1
    const plotTop = showLegend || trendLine ? PLOT_TOP_WITH_BAND : PLOT_TOP_PLAIN

    const allPoints = visibleSeries.flatMap((entry) => entry.points)
    const xExtent = extent(allPoints.map((point) => point.x))
    const yExtent = extent(allPoints.map((point) => point.y))
    const xScale = createAxisScale(xExtent.min, xExtent.max)
    const yScale = createAxisScale(yExtent.min, yExtent.max, 7)

    const toScreenX = (value: number) =>
      PLOT_LEFT + ((value - xScale.min) / (xScale.max - xScale.min)) * (PLOT_RIGHT - PLOT_LEFT)
    const toScreenY = (value: number) =>
      PLOT_BOTTOM - ((value - yScale.min) / (yScale.max - yScale.min)) * (PLOT_BOTTOM - plotTop)

    const projected = visibleSeries.map((entry) => {
      // 꺾은선은 측정 순서가 아니라 x가 커지는 순서로 이어야 선이 되돌아가지 않습니다.
      const ordered = kind === 'line' ? [...entry.points].sort((a, b) => a.x - b.x) : entry.points
      return ordered.map((point) => ({ point, cx: toScreenX(point.x), cy: toScreenY(point.y) }))
    })

    const trendSegment = trendLine
      ? {
          x1: toScreenX(xScale.min),
          y1: toScreenY(trendLine.slope * xScale.min + trendLine.intercept),
          x2: toScreenX(xScale.max),
          y2: toScreenY(trendLine.slope * xScale.max + trendLine.intercept),
        }
      : null

    return { visibleSeries, showLegend, plotTop, xScale, yScale, toScreenX, toScreenY, projected, trendSegment }
  }, [series, kind, trendLine])

  const { visibleSeries, showLegend, plotTop, xScale, yScale, toScreenX, toScreenY, projected, trendSegment } = geometry

  const legendPositions = useMemo(() => {
    let offset = PLOT_LEFT
    return visibleSeries.map((entry) => {
      const position = offset
      offset += estimateTextWidth(entry.label, LABEL_FONT_SIZE) + 44
      return position
    })
  }, [visibleSeries])

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGRectElement>) => {
      const svg = ownRef.current
      if (!svg) return
      const bounds = svg.getBoundingClientRect()
      if (bounds.width === 0 || bounds.height === 0) return

      const pointerX = ((event.clientX - bounds.left) / bounds.width) * CHART_WIDTH
      const pointerY = ((event.clientY - bounds.top) / bounds.height) * CHART_HEIGHT

      let nearest: HoveredPoint | null = null
      let nearestDistance = HOVER_RADIUS ** 2
      projected.forEach((points, seriesIndex) => {
        for (const entry of points) {
          const distance = (entry.cx - pointerX) ** 2 + (entry.cy - pointerY) ** 2
          if (distance >= nearestDistance) continue
          nearestDistance = distance
          nearest = {
            seriesLabel: visibleSeries[seriesIndex].label,
            point: entry.point,
            cx: entry.cx,
            cy: entry.cy,
          }
        }
      })

      setHovered(nearest)
    },
    [projected, visibleSeries],
  )

  return (
    <svg
      ref={attachRef}
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label={description}
      fontFamily="system-ui, -apple-system, 'Segoe UI', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif"
      className="h-auto w-full"
    >
      <rect x="0" y="0" width={CHART_WIDTH} height={CHART_HEIGHT} fill={SURFACE} />
      <defs>
        <clipPath id={clipId}>
          <rect x={PLOT_LEFT} y={plotTop} width={PLOT_RIGHT - PLOT_LEFT} height={PLOT_BOTTOM - plotTop} />
        </clipPath>
        {/*
          축 위에 정확히 놓인 측정값(예: 최솟값이 눈금과 같은 값일 때)이 반만
          그려지지 않도록, 점을 자르는 영역만 점 크기만큼 넓혀 둡니다.
        */}
        <clipPath id={markerClipId}>
          <rect
            x={PLOT_LEFT - MARKER_CLIP_PADDING}
            y={plotTop - MARKER_CLIP_PADDING}
            width={PLOT_RIGHT - PLOT_LEFT + MARKER_CLIP_PADDING * 2}
            height={PLOT_BOTTOM - plotTop + MARKER_CLIP_PADDING * 2}
          />
        </clipPath>
      </defs>

      {/* 논문 그림처럼 왼쪽·아래 두 축만 두고, 눈금은 안쪽을 향하게 합니다. */}
      <path
        d={`M ${PLOT_LEFT} ${plotTop} L ${PLOT_LEFT} ${PLOT_BOTTOM} L ${PLOT_RIGHT} ${PLOT_BOTTOM}`}
        fill="none"
        stroke={INK}
        strokeWidth="1"
      />
      {yScale.ticks.map((tick) => (
        <g key={`y-${tick}`}>
          <line x1={PLOT_LEFT} y1={toScreenY(tick)} x2={PLOT_LEFT + TICK_LENGTH} y2={toScreenY(tick)} stroke={INK} strokeWidth="1" />
          <text
            x={PLOT_LEFT - 10}
            y={toScreenY(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={LABEL_FONT_SIZE}
            fill={INK_SECONDARY}
          >
            {formatMeasurement(tick, { grouping: false })}
          </text>
        </g>
      ))}
      {xScale.ticks.map((tick) => (
        <g key={`x-${tick}`}>
          <line x1={toScreenX(tick)} y1={PLOT_BOTTOM} x2={toScreenX(tick)} y2={PLOT_BOTTOM - TICK_LENGTH} stroke={INK} strokeWidth="1" />
          <text x={toScreenX(tick)} y={PLOT_BOTTOM + 22} textAnchor="middle" fontSize={LABEL_FONT_SIZE} fill={INK_SECONDARY}>
            {formatMeasurement(tick, { grouping: false })}
          </text>
        </g>
      ))}

      <text x={(PLOT_LEFT + PLOT_RIGHT) / 2} y={CHART_HEIGHT - 26} textAnchor="middle" fontSize="15" fill={INK}>
        {xLabel}
      </text>
      <text
        x="26"
        y={(plotTop + PLOT_BOTTOM) / 2}
        textAnchor="middle"
        fontSize="15"
        fill={INK}
        transform={`rotate(-90 26 ${(plotTop + PLOT_BOTTOM) / 2})`}
      >
        {yLabel}
      </text>

      {showLegend &&
        visibleSeries.map((entry, index) => (
          <g key={entry.key}>
            <SeriesMarker shapeIndex={index} x={legendPositions[index] + 7} y={TOP_BAND_MIDDLE} />
            <text
              x={legendPositions[index] + 20}
              y={TOP_BAND_MIDDLE}
              dominantBaseline="middle"
              fontSize={LABEL_FONT_SIZE}
              fill={INK_SECONDARY}
            >
              {entry.label}
            </text>
          </g>
        ))}

      {trendLine && (
        <text x={PLOT_RIGHT} y={TOP_BAND_MIDDLE} textAnchor="end" dominantBaseline="middle" fontSize={LABEL_FONT_SIZE} fill={INK}>
          {trendLine.annotation}
        </text>
      )}

      {trendSegment && (
        <line
          x1={trendSegment.x1}
          y1={trendSegment.y1}
          x2={trendSegment.x2}
          y2={trendSegment.y2}
          stroke={INK}
          strokeWidth="1.5"
          strokeDasharray="7 5"
          clipPath={`url(#${clipId})`}
        />
      )}

      <g clipPath={`url(#${markerClipId})`}>
        {projected.map((points, seriesIndex) => (
          <g key={visibleSeries[seriesIndex].key}>
            {kind === 'line' && points.length > 1 && (
              <polyline
                points={points.map((entry) => `${entry.cx},${entry.cy}`).join(' ')}
                fill="none"
                stroke={SERIES_COLORS[seriesIndex]}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {(kind === 'scatter' || (PLOT_RIGHT - PLOT_LEFT) / Math.max(1, points.length - 1) >= MIN_MARKER_SPACING) &&
              points.map((entry, pointIndex) => (
                <SeriesMarker key={pointIndex} shapeIndex={seriesIndex} x={entry.cx} y={entry.cy} />
              ))}
          </g>
        ))}
      </g>

      <rect
        x={PLOT_LEFT}
        y={plotTop}
        width={PLOT_RIGHT - PLOT_LEFT}
        height={PLOT_BOTTOM - plotTop}
        fill="transparent"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHovered(null)}
      />

      {hovered && <HoverLabel hovered={hovered} xLabel={xLabel} yLabel={yLabel} />}
    </svg>
  )
}

function HoverLabel({ hovered, xLabel, yLabel }: { hovered: HoveredPoint; xLabel: string; yLabel: string }) {
  const lines = [
    hovered.seriesLabel,
    `${xLabel}: ${formatMeasurement(hovered.point.x)}`,
    `${yLabel}: ${formatMeasurement(hovered.point.y)}`,
  ]
  const width = Math.max(...lines.map((line) => estimateTextWidth(line, LABEL_FONT_SIZE))) + 20
  const height = lines.length * 18 + 12
  const x = Math.min(hovered.cx + 14, PLOT_RIGHT - width)
  const y = Math.max(hovered.cy - height - 12, 4)

  return (
    <g data-chart-overlay="true" pointerEvents="none">
      <circle cx={hovered.cx} cy={hovered.cy} r={MARKER_RADIUS + 4} fill="none" stroke={INK} strokeWidth="1.5" />
      <rect x={x} y={y} width={width} height={height} rx="6" fill={SURFACE} stroke={INK} strokeWidth="1" />
      {lines.map((line, index) => (
        <text key={line} x={x + 10} y={y + 22 + index * 18} fontSize={LABEL_FONT_SIZE} fill={index === 0 ? INK : INK_SECONDARY}>
          {line}
        </text>
      ))}
    </g>
  )
}
