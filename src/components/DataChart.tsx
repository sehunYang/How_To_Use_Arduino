/**
 * 논문 그림 형식의 그래프. 흰 바탕 · 검은 축 · 안쪽 눈금으로 그려서
 * 보고서에 그대로 붙여 넣을 수 있게 했습니다.
 *
 * 화면 테마(밝게/어둡게)와 상관없이 항상 흰 바탕으로 그립니다. 저장 버튼이 만드는
 * PNG는 화면에 보이는 그림을 그대로 복사한 것이라 둘이 달라지면 안 되고, 어두운 바탕
 * 그림은 인쇄물이나 보고서에 쓸 수 없기 때문입니다.
 *
 * 색은 두 가지 방식으로 배정합니다. 서로 다른 측정값(온도·습도)은 순서가 없으므로
 * 구별되는 색 세 가지를 고정된 순서로 쓰고, 실험 회차는 1회차·2회차처럼 순서가 있으므로
 * 같은 파랑을 옅은 쪽에서 짙은 쪽으로 단계지어 씁니다. 어느 쪽이든 색만으로 구분하지
 * 않도록 점 모양도 함께 다르게 그리고, 값은 언제나 아래 표에서 확인할 수 있습니다.
 */
import { useCallback, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { CONTEXT_COLOR, seriesPaletteColors, type SeriesPalette } from '@/lib/chartPalette'
import { createAxisScale, estimateTextWidth, extent } from '@/lib/chartScale'
import { formatMeasurement, type MeasurementPoint } from '@/lib/dataStats'

export const CHART_WIDTH = 760
export const CHART_HEIGHT = 470

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
const CONTEXT_RADIUS = 2.5
/** 상자 폭의 최댓값과, 이웃한 상자 사이에 남길 자리의 비율 */
const MAX_BOX_WIDTH = 16
const BOX_WIDTH_RATIO = 0.6
/** 수염 끝 가로선은 상자 폭의 절반. 관례를 따르면 상자와 수염이 한눈에 구별됩니다. */
const WHISKER_CAP_RATIO = 0.5
/** 상자 위에 얹는 평균 점. 값의 퍼짐이 작을 때 점이 상자를 덮지 않도록 작게 그립니다. */
const MEAN_RADIUS = 2.5
const LABEL_FONT_SIZE = 13
/**
 * 꺾은선에서 이웃한 점 사이가 이보다 좁으면 점을 그리지 않고 선만 남깁니다.
 * 점이 서로 닿을 만큼 촘촘하면 점들이 선을 덮어 산점도처럼 보이기 때문입니다.
 */
const MIN_MARKER_SPACING = 16
/** 이보다 먼 곳을 가리키면 엉뚱한 점을 설명하게 되므로 표시하지 않습니다. */
const HOVER_RADIUS = 40

export type ChartKind = 'scatter' | 'line'

/**
 * 상자그림 한 칸을 그리는 다섯 수치. 수염은 최솟값과 최댓값까지 그립니다.
 * 회차가 서너 번뿐인 학교 실험에서는 1.5배 사분위범위로 이상값을 가려내는 규칙이
 * 뜻을 잃기 때문에, 모든 측정값을 수염 안에 담아 그대로 보여 줍니다.
 */
export interface ChartBox {
  min: number
  quartile1: number
  median: number
  quartile3: number
  max: number
}

export interface ChartPoint extends MeasurementPoint {
  /** 있으면 점 자리에 상자그림을 함께 그립니다. `y`는 상자 위에 얹는 평균입니다. */
  box?: ChartBox | null
  /**
   * 있으면 평균 위아래로 이만큼씩 오차막대를 그립니다(보통 표준편차).
   * 보고서 그림에서 가장 많이 쓰는 표시라 상자그림과 따로 고를 수 있게 두었습니다.
   */
  errorBar?: number | null
  /** 점을 가리켰을 때 값과 함께 보여 줄 한 줄 설명 */
  note?: string
}

/** 상자그림이나 오차막대가 붙은 점은 평균을 작게 찍습니다. 표시가 점에 가리지 않게 하려고요. */
function hasSpreadMark(point: ChartPoint): boolean {
  return Boolean(point.box) || (point.errorBar !== null && point.errorBar !== undefined)
}

export interface ChartSeries {
  key: string
  label: string
  points: readonly ChartPoint[]
}

export interface TrendLine {
  slope: number
  intercept: number
  /** 그래프 안에 함께 적을 회귀식과 R² 문구 */
  annotation: string
}

function SeriesMarker({ shapeIndex, color, x, y }: { shapeIndex: number; color: string; x: number; y: number }) {
  // 겹친 점끼리도 구분되도록 바탕색 테두리를 두릅니다.
  const ring = { stroke: SURFACE, strokeWidth: 2 }
  const size = MARKER_RADIUS + 1

  if (shapeIndex === 1) {
    return <path d={`M ${x} ${y - size} L ${x + size} ${y} L ${x} ${y + size} L ${x - size} ${y} Z`} fill={color} {...ring} />
  }
  if (shapeIndex === 2) {
    return <path d={`M ${x} ${y - size - 0.5} L ${x + size} ${y + MARKER_RADIUS} L ${x - size} ${y + MARKER_RADIUS} Z`} fill={color} {...ring} />
  }
  if (shapeIndex === 3) {
    return <rect x={x - MARKER_RADIUS} y={y - MARKER_RADIUS} width={MARKER_RADIUS * 2} height={MARKER_RADIUS * 2} fill={color} {...ring} />
  }
  if (shapeIndex === 4) {
    return <path d={`M ${x} ${y + size + 0.5} L ${x + size} ${y - MARKER_RADIUS} L ${x - size} ${y - MARKER_RADIUS} Z`} fill={color} {...ring} />
  }
  return <circle cx={x} cy={y} r={MARKER_RADIUS} fill={color} {...ring} />
}

interface HoveredPoint {
  seriesLabel: string
  point: ChartPoint
  cx: number
  cy: number
}

export interface DataChartProps {
  series: readonly ChartSeries[]
  xLabel: string
  yLabel: string
  kind: ChartKind
  trendLine?: TrendLine | null
  /** 계열이 측정값 종류인지 실험 회차인지에 따라 색 배정 방식을 고릅니다. */
  palette?: SeriesPalette
  /** 평균 뒤에 옅게 깔아 둘 원본 측정값 */
  contextPoints?: readonly MeasurementPoint[]
  contextLabel?: string
  /** 화면 낭독기가 읽어 줄 그래프 설명 */
  description: string
  /** PNG 저장 버튼이 그림을 복사할 수 있도록 SVG를 밖으로 전달합니다. */
  chartRef?: RefObject<SVGSVGElement | null>
}

export function DataChart({
  series,
  xLabel,
  yLabel,
  kind,
  trendLine,
  palette = 'variable',
  contextPoints,
  contextLabel,
  description,
  chartRef,
}: DataChartProps) {
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
    const colors = seriesPaletteColors(palette)
    const visibleSeries = series.slice(0, colors.length)
    const hasContext = Boolean(contextPoints && contextPoints.length > 0)
    const showLegend = visibleSeries.length > 1 || hasContext
    const plotTop = showLegend || trendLine ? PLOT_TOP_WITH_BAND : PLOT_TOP_PLAIN

    const allPoints = visibleSeries.flatMap((entry) => entry.points)
    const xExtent = extent([...allPoints, ...(contextPoints ?? [])].map((point) => point.x))
    // 수염이나 오차막대 끝이 잘리지 않도록 세로 범위에 그 끝까지 함께 넣습니다.
    const yExtent = extent([
      ...allPoints.flatMap((point) => {
        if (point.box) return [point.box.min, point.box.max]
        if (point.errorBar !== null && point.errorBar !== undefined) {
          return [point.y - point.errorBar, point.y + point.errorBar]
        }
        return [point.y]
      }),
      ...(contextPoints ?? []).map((point) => point.y),
    ])
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

    const projectedContext = (contextPoints ?? []).map((point) => ({
      cx: toScreenX(point.x),
      cy: toScreenY(point.y),
    }))

    const boxCount = Math.max(...visibleSeries.map((entry) => entry.points.length), 1)
    const boxWidth = Math.min(MAX_BOX_WIDTH, ((PLOT_RIGHT - PLOT_LEFT) / boxCount) * BOX_WIDTH_RATIO)

    const trendSegment = trendLine
      ? {
          x1: toScreenX(xScale.min),
          y1: toScreenY(trendLine.slope * xScale.min + trendLine.intercept),
          x2: toScreenX(xScale.max),
          y2: toScreenY(trendLine.slope * xScale.max + trendLine.intercept),
        }
      : null

    return {
      colors,
      visibleSeries,
      hasContext,
      showLegend,
      plotTop,
      xScale,
      yScale,
      toScreenX,
      toScreenY,
      projected,
      projectedContext,
      boxWidth,
      trendSegment,
    }
  }, [series, kind, trendLine, palette, contextPoints])

  const {
    colors,
    visibleSeries,
    hasContext,
    showLegend,
    plotTop,
    xScale,
    yScale,
    toScreenY,
    toScreenX,
    projected,
    projectedContext,
    boxWidth,
    trendSegment,
  } = geometry

  const legendEntries = useMemo(() => {
    const entries: { key: string; label: string; color: string; shapeIndex: number }[] = visibleSeries.map((entry, index) => ({
      key: entry.key,
      label: entry.label,
      color: colors[index],
      shapeIndex: index,
    }))
    if (hasContext) {
      entries.push({
        key: '__context',
        label: contextLabel ?? '회차별 측정값',
        color: CONTEXT_COLOR,
        shapeIndex: 0,
      })
    }
    let offset = PLOT_LEFT
    return entries.map((entry) => {
      const position = offset
      offset += estimateTextWidth(entry.label, LABEL_FONT_SIZE) + 44
      return { ...entry, x: position }
    })
  }, [visibleSeries, colors, hasContext, contextLabel])

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
        legendEntries.map((entry) => (
          <g key={entry.key}>
            <SeriesMarker shapeIndex={entry.shapeIndex} color={entry.color} x={entry.x + 7} y={TOP_BAND_MIDDLE} />
            <text x={entry.x + 20} y={TOP_BAND_MIDDLE} dominantBaseline="middle" fontSize={LABEL_FONT_SIZE} fill={INK_SECONDARY}>
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
        {projectedContext.map((entry, index) => (
          <circle key={index} cx={entry.cx} cy={entry.cy} r={CONTEXT_RADIUS} fill={CONTEXT_COLOR} />
        ))}

        {projected.map((points, seriesIndex) => (
          <g key={visibleSeries[seriesIndex].key}>
            {points.map((entry, pointIndex) => {
              if (entry.point.box) {
                return (
                  <BoxMark
                    key={pointIndex}
                    box={entry.point.box}
                    color={colors[seriesIndex]}
                    cx={entry.cx}
                    width={boxWidth}
                    toScreenY={toScreenY}
                  />
                )
              }
              if (entry.point.errorBar === null || entry.point.errorBar === undefined) return null
              return (
                <ErrorBarMark
                  key={pointIndex}
                  center={entry.point.y}
                  spread={entry.point.errorBar}
                  color={colors[seriesIndex]}
                  cx={entry.cx}
                  width={boxWidth}
                  toScreenY={toScreenY}
                />
              )
            })}

            {kind === 'line' && points.length > 1 && (
              <polyline
                points={points.map((entry) => `${entry.cx},${entry.cy}`).join(' ')}
                fill="none"
                stroke={colors[seriesIndex]}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {(kind === 'scatter' || (PLOT_RIGHT - PLOT_LEFT) / Math.max(1, points.length - 1) >= MIN_MARKER_SPACING) &&
              points.map((entry, pointIndex) =>
                hasSpreadMark(entry.point) ? (
                  <circle
                    key={pointIndex}
                    cx={entry.cx}
                    cy={entry.cy}
                    r={MEAN_RADIUS}
                    fill={colors[seriesIndex]}
                    stroke={SURFACE}
                    strokeWidth="1.5"
                  />
                ) : (
                  <SeriesMarker
                    key={pointIndex}
                    shapeIndex={seriesIndex}
                    color={colors[seriesIndex]}
                    x={entry.cx}
                    y={entry.cy}
                  />
                ),
              )}
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

function BoxMark({
  box,
  color,
  cx,
  width,
  toScreenY,
}: {
  box: ChartBox
  color: string
  cx: number
  width: number
  toScreenY: (value: number) => number
}) {
  const half = width / 2
  const capHalf = half * WHISKER_CAP_RATIO
  const top = toScreenY(box.quartile3)
  const bottom = toScreenY(box.quartile1)

  return (
    <g stroke={color} strokeWidth="1.5" fill="none">
      {/* 수염: 상자 위아래로 최댓값·최솟값까지 */}
      <line x1={cx} y1={toScreenY(box.max)} x2={cx} y2={top} />
      <line x1={cx} y1={bottom} x2={cx} y2={toScreenY(box.min)} />
      <line x1={cx - capHalf} y1={toScreenY(box.max)} x2={cx + capHalf} y2={toScreenY(box.max)} />
      <line x1={cx - capHalf} y1={toScreenY(box.min)} x2={cx + capHalf} y2={toScreenY(box.min)} />
      {/* 상자: 제1사분위수부터 제3사분위수까지. 옅은 채움이라 뒤의 측정값이 비칩니다. */}
      <rect
        x={cx - half}
        y={top}
        width={width}
        height={Math.max(bottom - top, 1)}
        fill={color}
        fillOpacity="0.12"
      />
      <line x1={cx - half} y1={toScreenY(box.median)} x2={cx + half} y2={toScreenY(box.median)} strokeWidth="2" />
    </g>
  )
}

/**
 * 평균 위아래로 같은 길이만큼 뻗는 오차막대. 끝의 가로선은 상자그림의 수염과
 * 같은 폭으로 그려서, 두 표시를 번갈아 봐도 크기 감각이 흔들리지 않게 합니다.
 */
function ErrorBarMark({
  center,
  spread,
  color,
  cx,
  width,
  toScreenY,
}: {
  center: number
  spread: number
  color: string
  cx: number
  width: number
  toScreenY: (value: number) => number
}) {
  const capHalf = (width / 2) * WHISKER_CAP_RATIO
  const top = toScreenY(center + spread)
  const bottom = toScreenY(center - spread)

  return (
    <g stroke={color} strokeWidth="1.5" fill="none">
      <line x1={cx} y1={top} x2={cx} y2={bottom} />
      <line x1={cx - capHalf} y1={top} x2={cx + capHalf} y2={top} />
      <line x1={cx - capHalf} y1={bottom} x2={cx + capHalf} y2={bottom} />
    </g>
  )
}

function HoverLabel({ hovered, xLabel, yLabel }: { hovered: HoveredPoint; xLabel: string; yLabel: string }) {
  const lines = [
    hovered.seriesLabel,
    `${xLabel}: ${formatMeasurement(hovered.point.x)}`,
    `${yLabel}: ${formatMeasurement(hovered.point.y)}`,
    ...(hovered.point.note ? [hovered.point.note] : []),
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
