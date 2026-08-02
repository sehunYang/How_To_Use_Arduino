import { useCallback, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  DataChart,
  type ChartKind,
  type ChartPoint,
  type ChartSeries,
} from '@/components/DataChart'
import {
  MAX_SERIES,
  MAX_TRIAL_SERIES,
  SERIES_SHAPE_NAMES,
  seriesPaletteColors,
} from '@/lib/chartPalette'
import { downloadChartPng } from '@/lib/chartExport'
import {
  collectNumericColumns,
  formatMeasurement,
  pairValues,
  readNamedColumn,
  summarizeColumn,
  summarizeRelation,
  type MeasurementPoint,
  type NumericColumn,
  type RelationSummary,
} from '@/lib/dataStats'
import { buildCsv, convertSerialTextToCsv, downloadSerialCsv, type SerialCsvResult } from '@/lib/serialCsv'
import {
  MAX_TRUSTWORTHY_SPREAD_RATIO,
  aggregateByOrder,
  describeHeaderMismatch,
  trialLabel,
  type Trial,
} from '@/lib/trialAnalysis'

const example = `time_ms,temperature_c,humidity_pct
0,21.5,48.2
1000,21.7,48.0`

const PREVIEW_ROW_LIMIT = 20
const TRIAL_COLUMN_NAME = '회차'

const SUMMARY_COLUMNS = [
  { key: 'count', label: '개수(n)' },
  { key: 'mean', label: '평균' },
  { key: 'standardDeviation', label: '표준편차' },
  { key: 'min', label: '최솟값' },
  { key: 'quartile1', label: '제1사분위수' },
  { key: 'median', label: '중앙값' },
  { key: 'quartile3', label: '제3사분위수' },
  { key: 'max', label: '최댓값' },
  { key: 'range', label: '범위' },
] as const

type TrialView = 'box' | 'perTrial'

/** 회귀직선을 `y = 2.5x − 3.1` 형태의 한 줄로 적습니다. */
function formatRegressionEquation(relation: RelationSummary) {
  const slope = formatMeasurement(relation.slope, { grouping: false })
  const intercept = formatMeasurement(Math.abs(relation.intercept), { grouping: false })
  return `y = ${slope}x ${relation.intercept < 0 ? '−' : '+'} ${intercept}`
}

/** 상관계수의 크기를 학생이 읽을 수 있는 문장으로 바꿉니다. */
function describeCorrelation(correlation: number) {
  const strength = Math.abs(correlation)
  const direction = correlation > 0 ? '한쪽이 커질 때 다른 쪽도 커지는' : '한쪽이 커질 때 다른 쪽은 작아지는'
  if (strength >= 0.9) return `${direction} 관계가 매우 뚜렷합니다.`
  if (strength >= 0.7) return `${direction} 관계가 뚜렷한 편입니다.`
  if (strength >= 0.4) return `${direction} 경향이 어느 정도 보입니다.`
  return '두 변인이 직선 관계를 이룬다고 보기 어렵습니다.'
}

export function DataAnalysisPage() {
  const [input, setInput] = useState('')
  const [trials, setTrials] = useState<Trial[]>([])
  const [lastResult, setLastResult] = useState<SerialCsvResult | null>(null)
  const [mismatchError, setMismatchError] = useState<string | null>(null)
  const [xName, setXName] = useState<string | null>(null)
  const [yNames, setYNames] = useState<string[]>([])
  const [chartKind, setChartKind] = useState<ChartKind>('scatter')
  const [trialView, setTrialView] = useState<TrialView>('box')
  const [showTrialPoints, setShowTrialPoints] = useState(true)
  const [showTrendLine, setShowTrendLine] = useState(true)
  const [chartError, setChartError] = useState<string | null>(null)
  /**
   * 붙여넣은 회차는 이 화면 안에만 있고 어디에도 저장되지 않습니다. 잘못 지우면 실험을
   * 여러 번 되풀이해 모은 값이 사라지므로, 지우기 전 상태를 한 벌 들고 있다가 되돌릴 수
   * 있게 합니다. 지우기 전에 한 번 더 묻는 대신 이렇게 한 이유는, 지우기는 자주 하는 일이라
   * 매번 확인을 받으면 성가시고 결국 읽지 않고 누르게 되기 때문입니다.
   */
  const [undoable, setUndoable] = useState<{ input: string; trials: Trial[]; xName: string | null; yNames: string[] } | null>(null)
  const chartRef = useRef<SVGSVGElement>(null)

  const hasRepeats = trials.length >= 2
  const header = useMemo(() => trials[0]?.header ?? [], [trials])
  const combinedRows = useMemo(() => trials.flatMap((trial) => trial.rows), [trials])
  const totalRowCount = combinedRows.length

  const numericColumns = useMemo(
    () => collectNumericColumns(header, combinedRows),
    [header, combinedRows],
  )

  /** 회차별 요약은 회차 수만큼 행이 늘어나므로 측정값별로 묶어 한 표에 담습니다. */
  const summaries = useMemo(
    () =>
      numericColumns.map((column) => ({
        column,
        overall: summarizeColumn(column.values.filter((value): value is number => value !== null)),
        perTrial: hasRepeats
          ? trials.map((trial) => ({
              label: trial.label,
              summary: summarizeColumn(
                readNamedColumn(trial.header, trial.rows, column.name).filter(
                  (value): value is number => value !== null,
                ),
              ),
            }))
          : [],
      })),
    [numericColumns, trials, hasRepeats],
  )

  const xColumn = numericColumns.find((column) => column.name === xName) ?? null
  const yColumns = useMemo(
    () =>
      yNames
        .map((name) => numericColumns.find((column) => column.name === name))
        .filter((column): column is NumericColumn => Boolean(column)),
    [yNames, numericColumns],
  )

  /** 회차마다 가로축·세로축 값을 이름으로 찾아 짝지은 점 목록 */
  const trialPoints = useMemo(() => {
    if (!xColumn || yColumns.length !== 1) return []
    const yColumn = yColumns[0]
    return trials.map((trial) =>
      pairValues(
        readNamedColumn(trial.header, trial.rows, xColumn.name),
        readNamedColumn(trial.header, trial.rows, yColumn.name),
      ),
    )
  }, [trials, xColumn, yColumns])

  const aggregate = useMemo(
    () => (hasRepeats && trialPoints.length > 0 ? aggregateByOrder(trialPoints) : null),
    [hasRepeats, trialPoints],
  )

  /**
   * 회차가 색으로 구분할 수 있는 수를 넘으면 고른 값과 관계없이 평균 보기로 그립니다.
   * 라디오 버튼만 막아 두면 회차를 더하다가 한계를 넘었을 때 화면이 조용히 잘린 그래프를
   * 보여 주게 됩니다.
   */
  const tooManyTrialsForPerTrialView = trials.length > MAX_TRIAL_SERIES
  const effectiveTrialView: TrialView = tooManyTrialsForPerTrialView ? 'box' : trialView
  const usesBoxView = hasRepeats && effectiveTrialView === 'box'

  const chartSeries = useMemo<ChartSeries[]>(() => {
    if (!xColumn) return []

    if (usesBoxView && aggregate) {
      const points: ChartPoint[] = aggregate.points.map((point) => ({
        x: point.x,
        y: point.y,
        box: point.count >= 2
          ? {
              min: point.min,
              quartile1: point.quartile1,
              median: point.median,
              quartile3: point.quartile3,
              max: point.max,
            }
          : null,
        note: `${point.count}회 측정 · 중앙값 ${formatMeasurement(point.median)} · 범위 ${formatMeasurement(point.min)}~${formatMeasurement(point.max)}`,
      }))
      return points.length > 0 ? [{ key: 'box', label: `${trials.length}회 요약`, points }] : []
    }

    if (hasRepeats) {
      return trials
        .map((trial, index) => ({ key: String(trial.id), label: trial.label, points: trialPoints[index] ?? [] }))
        .filter((entry) => entry.points.length > 0)
    }

    return yColumns
      .map((column) => ({
        key: column.name,
        label: column.name,
        points: pairValues(xColumn.values, column.values),
      }))
      .filter((entry) => entry.points.length > 0)
  }, [xColumn, yColumns, usesBoxView, aggregate, hasRepeats, trials, trialPoints])

  const contextPoints = useMemo<MeasurementPoint[] | undefined>(
    () => (usesBoxView && showTrialPoints ? trialPoints.flat() : undefined),
    [usesBoxView, showTrialPoints, trialPoints],
  )

  /** 회귀직선은 그래프에 실제로 그려진 계열이 하나일 때만 뜻이 있습니다. */
  const relation = useMemo(
    () => (chartSeries.length === 1 ? summarizeRelation(chartSeries[0].points) : null),
    [chartSeries],
  )

  const perTrialRelations = useMemo(
    () =>
      hasRepeats
        ? trials.map((trial, index) => ({
            label: trial.label,
            relation: summarizeRelation(trialPoints[index] ?? []),
          }))
        : [],
    [hasRepeats, trials, trialPoints],
  )

  const slopeSpread = useMemo(() => {
    const slopes = perTrialRelations
      .map((entry) => entry.relation?.slope)
      .filter((slope): slope is number => slope !== undefined)
    return slopes.length >= 2 ? summarizeColumn(slopes) : null
  }, [perTrialRelations])

  const trendLine = useMemo(() => {
    if (!showTrendLine || !relation) return null
    const determination = relation.determination
    const annotation =
      determination === null
        ? formatRegressionEquation(relation)
        : `${formatRegressionEquation(relation)}, R² = ${formatMeasurement(determination)}`
    return { slope: relation.slope, intercept: relation.intercept, annotation }
  }, [showTrendLine, relation])

  function addTrial() {
    const parsed = convertSerialTextToCsv(input)
    setLastResult(parsed)
    setMismatchError(null)
    setChartError(null)
    if (!parsed.ok) return

    const firstTrial = trials[0]
    if (firstTrial) {
      const mismatch = describeHeaderMismatch(firstTrial.header, parsed.header)
      if (mismatch) {
        setMismatchError(mismatch)
        return
      }
    }

    const nextTrials = [
      ...trials,
      {
        id: (trials.at(-1)?.id ?? 0) + 1,
        label: trialLabel(trials.length + 1),
        header: parsed.header,
        rows: parsed.rows,
      },
    ]
    setTrials(nextTrials)
    // 다음 회차를 바로 붙여넣을 수 있도록 입력을 비웁니다.
    setInput('')
    // 회차 비교는 변인 하나만 그리므로, 2회차가 들어오는 순간 선택을 하나로 줄입니다.
    if (nextTrials.length >= 2) setYNames((names) => names.slice(0, 1))

    if (!firstTrial) {
      // 아두이노 스케치는 보통 시간을 첫 열에 출력하므로 첫 측정값 열을 가로축으로 둡니다.
      const columns = collectNumericColumns(parsed.header, parsed.rows)
      setXName(columns[0]?.name ?? null)
      setYNames(columns[1] ? [columns[1].name] : [])
    }
  }

  function removeTrial(id: number) {
    // 회차를 지우면 남은 회차의 번호를 다시 매겨 2회차 다음이 4회차가 되는 일이 없게 합니다.
    setTrials((current) =>
      current
        .filter((trial) => trial.id !== id)
        .map((trial, index) => ({ ...trial, label: trialLabel(index + 1) })),
    )
    setChartError(null)
  }

  function reset() {
    if (input || trials.length > 0) setUndoable({ input, trials, xName, yNames })
    setInput('')
    setTrials([])
    setLastResult(null)
    setMismatchError(null)
    setXName(null)
    setYNames([])
    setChartError(null)
  }

  function undoReset() {
    if (!undoable) return
    setInput(undoable.input)
    setTrials(undoable.trials)
    setXName(undoable.xName)
    setYNames(undoable.yNames)
    setUndoable(null)
  }

  function changeXColumn(nextName: string) {
    setXName(nextName)
    setYNames((names) => {
      // 같은 열을 두 축에 함께 쓰면 기울기 1인 직선만 그려져 얻을 정보가 없습니다.
      const kept = names.filter((name) => name !== nextName)
      if (kept.length > 0) return kept
      // 세로축에 있던 변인을 가로축으로 옮겼으므로 두 축을 맞바꿉니다.
      const swapped = xName && xName !== nextName ? xName : numericColumns.find((column) => column.name !== nextName)?.name
      return swapped ? [swapped] : []
    })
  }

  function toggleYColumn(name: string) {
    setYNames((names) =>
      names.includes(name)
        ? names.filter((value) => value !== name)
        : names.length >= MAX_SERIES
          ? names
          : [...names, name],
    )
  }

  const saveChartPng = useCallback(async () => {
    const svg = chartRef.current
    if (!svg) return
    setChartError(null)
    try {
      await downloadChartPng(svg)
    } catch (error) {
      setChartError(error instanceof Error ? error.message : '그래프를 그림으로 저장하지 못했습니다.')
    }
  }, [])

  function saveCsv() {
    if (trials.length === 0) return
    if (trials.length === 1) {
      downloadSerialCsv(buildCsv(trials[0].header, trials[0].rows))
      return
    }
    // 회차를 구분할 수 없는 CSV는 반복 실험 기록으로 쓸 수 없으므로 회차 열을 앞에 붙입니다.
    const rows = trials.flatMap((trial) =>
      trial.rows.map((row) => [trial.label, ...header.map((name) => row[trial.header.indexOf(name)] ?? '')]),
    )
    downloadSerialCsv(buildCsv([TRIAL_COLUMN_NAME, ...header], rows))
  }

  const seriesLabels = chartSeries.map((entry) => entry.label).join(', ')
  const pointCount = chartSeries.reduce((total, entry) => total + entry.points.length, 0)
  const yAxisLabel = hasRepeats ? (yColumns[0]?.name ?? '') : seriesLabels
  const boxNote = usesBoxView
    ? ' 상자는 제1사분위수부터 제3사분위수까지이고, 가운데 굵은 선은 중앙값, 점은 평균, 수염은 최솟값과 최댓값입니다.'
    : ''
  const chartCaption = xColumn
    ? `그림 1. ${xColumn.name}에 따른 ${yAxisLabel} (${hasRepeats ? `${trials.length}회 반복, ` : ''}${usesBoxView ? '상자' : '점'} ${pointCount.toLocaleString('ko-KR')}개).${boxNote}`
    : ''
  const chartDescription = xColumn
    ? `가로축은 ${xColumn.name}, 세로축은 ${yAxisLabel}인 ${chartKind === 'scatter' ? '산점도' : '꺾은선 그래프'}입니다. ${
        usesBoxView
          ? `${trials.length}개 회차의 값을 측정 순번마다 상자그림으로 그렸습니다.`
          : `계열은 ${seriesLabels}입니다.`
      } ${usesBoxView ? '상자는' : '점은'} 모두 ${pointCount.toLocaleString('ko-KR')}개입니다.`
    : ''

  const spreadWarning = aggregate && aggregate.worstSpreadRatio > MAX_TRUSTWORTHY_SPREAD_RATIO

  return (
    <div className="mx-auto max-w-5xl py-8 md:py-12">
      <p className="text-caption font-semibold uppercase tracking-widest text-accent">시리얼 데이터 분석</p>
      <h1 className="mt-3 text-3xl font-semibold md:text-4xl">데이터 변환·분석</h1>
      <p className="mt-4 max-w-3xl text-body text-muted">
        Arduino IDE 시리얼 모니터에서 전체 내용을 복사해 붙여넣으세요. 실험을 여러 번 했다면 회차마다 붙여넣어 더할 수
        있고, 회차 사이에 값이 얼마나 흩어졌는지까지 그래프에 함께 그립니다. 결과는 CSV 파일과 논문 형식 PNG 그림으로
        저장할 수 있습니다.
      </p>

      <section aria-labelledby="paste-step" className="mt-8">
        <h2 id="paste-step" className="text-heading font-semibold">1. 측정값 붙여넣기</h2>

        <div className="mt-4 rounded-card border border-border bg-muted-background p-5">
          <h3 className="text-body font-semibold">붙여넣기 형식</h3>
          <pre className="mt-3 overflow-x-auto whitespace-pre rounded-card border border-border bg-background p-4 text-caption"><code>{example}</code></pre>
          <p className="mt-3 text-caption text-muted">
            쉼표는 값과 값 사이에만 넣고, 각 행의 마지막에는 넣지 않습니다. 회차를 더할 때는 열 이름이 1회차와 같아야
            합니다.
          </p>
        </div>

        <div className="mt-6">
          <label htmlFor="serial-data" className="text-body font-semibold">시리얼 모니터 내용</label>
          <textarea
            id="serial-data"
            value={input}
            onChange={(event) => {
              setInput(event.target.value)
              setLastResult(null)
              setMismatchError(null)
            }}
            className="mt-2 min-h-64 w-full resize-y rounded-card border border-border bg-background p-4 font-mono text-caption outline-none focus:border-accent"
            placeholder="시리얼 모니터에서 Ctrl+A, Ctrl+C로 복사한 내용을 붙여넣으세요."
            spellCheck={false}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button size="lg" onClick={addTrial} disabled={!input.trim()}>
            {trials.length === 0 ? '데이터 분석하기' : `${trialLabel(trials.length + 1)}로 추가하기`}
          </Button>
          <Button size="lg" variant="outline" onClick={reset} disabled={!input && trials.length === 0}>
            전체 지우기
          </Button>
        </div>
        {undoable && trials.length === 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-card border border-border bg-muted-background p-4">
            <p className="text-caption">
              {undoable.trials.length > 0
                ? `${undoable.trials.length}개 회차를 지웠습니다.`
                : '붙여넣은 내용을 지웠습니다.'}
            </p>
            <Button size="sm" onClick={undoReset}>되돌리기</Button>
          </div>
        )}

        {mismatchError && (
          <div role="alert" className="mt-6 rounded-card border border-danger bg-danger-background p-4 text-danger">
            <p className="font-semibold">이 데이터를 회차로 더할 수 없습니다.</p>
            <p className="mt-1">{mismatchError}</p>
          </div>
        )}

        {lastResult && !lastResult.ok && (
          <div role="alert" className="mt-6 rounded-card border border-danger bg-danger-background p-4 text-danger">
            <p className="font-semibold">데이터를 읽을 수 없습니다.</p>
            <p className="mt-1">{lastResult.error}</p>
          </div>
        )}

        {trials.length > 0 && (
          <div className="mt-6 rounded-card border border-success bg-success-background p-4 text-success">
            <p role="status" className="font-semibold">
              {trials.length}개 회차, {header.length}개 열, 모두 {totalRowCount.toLocaleString('ko-KR')}개 데이터 행을
              읽었습니다.
            </p>
            <p className="mt-1 text-caption">그중 숫자로 읽을 수 있는 측정값 열은 {numericColumns.length}개입니다.</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {trials.map((trial) => (
                <li
                  key={trial.id}
                  className="flex items-center gap-2 rounded-card border border-success px-3 py-1 text-caption"
                >
                  <span className="font-medium">{trial.label}</span>
                  <span>{trial.rows.length.toLocaleString('ko-KR')}행</span>
                  <button
                    onClick={() => removeTrial(trial.id)}
                    className="rounded-card px-1 font-semibold hover:bg-background"
                    aria-label={`${trial.label} 빼기`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <Button variant="outline" onClick={saveCsv}>CSV 파일로 저장</Button>
              {hasRepeats && <span className="ml-3 text-caption">회차를 구분하는 열이 맨 앞에 함께 저장됩니다.</span>}
            </div>
          </div>
        )}

        {lastResult && lastResult.excludedRows.length > 0 && (
          <aside aria-labelledby="excluded-rows" className="mt-4 rounded-card border border-warning bg-warning-background p-4 text-warning">
            <h3 id="excluded-rows" className="font-semibold">
              마지막으로 붙여넣은 내용에서 {lastResult.excludedRows.length}개 행을 제외했습니다.
            </h3>
            <p className="mt-1 text-caption">제외된 행: {lastResult.excludedRows.map((row) => row.lineNumber).join(', ')}</p>
            <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-caption">
              {lastResult.excludedRows.map((row) => (
                <li key={row.lineNumber}>{row.lineNumber}번째 줄: {row.reason}</li>
              ))}
            </ul>
          </aside>
        )}
      </section>

      {trials.length > 0 && (
        <>
          <section aria-labelledby="summary-step" className="mt-12">
            <h2 id="summary-step" className="text-heading font-semibold">2. 측정값 요약</h2>
            <p className="mt-2 text-body text-muted">
              각 측정값 열이 어떤 범위에 얼마나 퍼져 있는지 보여 줍니다. 표준편차는 반복 측정한 값들이 평균에서 흩어진
              정도이며, 결과를 얼마나 믿을 수 있는지 보여 줍니다. 사분위수는 값을 크기순으로 늘어놓았을 때의 25%·50%·75%
              지점입니다.
              {hasRepeats && ' 회차별 행을 함께 두어 실험을 다시 했을 때 값이 얼마나 되풀이되는지 볼 수 있습니다.'}
            </p>

            {summaries.length === 0 ? (
              <p className="mt-4 rounded-card border border-border bg-muted-background p-4 text-body text-muted">
                숫자로 읽을 수 있는 열이 없습니다. 시리얼 모니터가 값 대신 문장을 출력하고 있지 않은지 확인하세요.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-caption">
                  <caption className="sr-only">측정값 열별 요약 통계</caption>
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th scope="col" className="py-2 pr-4 font-semibold">측정값</th>
                      {hasRepeats && <th scope="col" className="py-2 pr-4 font-semibold">구분</th>}
                      {SUMMARY_COLUMNS.map((column) => (
                        <th key={column.key} scope="col" className="py-2 pr-4 text-right font-semibold whitespace-nowrap">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summaries.flatMap(({ column, overall, perTrial }) =>
                      [{ label: '전체', summary: overall }, ...perTrial].map((entry, entryIndex) => (
                        <tr key={`${column.name}-${entry.label}`} className="border-b border-border">
                          {entryIndex === 0 && (
                            <th
                              scope="row"
                              rowSpan={hasRepeats ? perTrial.length + 1 : 1}
                              className="py-2 pr-4 text-left align-top font-medium whitespace-nowrap"
                            >
                              {column.name}
                            </th>
                          )}
                          {hasRepeats && <td className="py-2 pr-4 whitespace-nowrap">{entry.label}</td>}
                          {SUMMARY_COLUMNS.map((summaryColumn) => {
                            const value = entry.summary?.[summaryColumn.key] ?? null
                            return (
                              <td key={summaryColumn.key} className="py-2 pr-4 text-right tabular-nums whitespace-nowrap">
                                {value === null ? '—' : formatMeasurement(value)}
                              </td>
                            )
                          })}
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="chart-step" className="mt-12">
            <h2 id="chart-step" className="text-heading font-semibold">3. 그래프 그리기</h2>
            <p className="mt-2 text-body text-muted">
              가로축과 세로축에 놓을 변인을 고르세요. 그래프는 흰 바탕·검은 축의 논문 그림 형식으로 그려지며, 화면 테마와
              상관없이 항상 같은 모습으로 저장됩니다.
            </p>

            {numericColumns.length < 2 ? (
              <p className="mt-4 rounded-card border border-border bg-muted-background p-4 text-body text-muted">
                그래프를 그리려면 숫자 열이 두 개 이상 필요합니다. 시간과 측정값을 함께 출력하도록 스케치를 고쳐 보세요.
              </p>
            ) : (
              <>
                <div className="mt-4 grid gap-6 md:grid-cols-2">
                  <div>
                    <label htmlFor="x-axis-column" className="text-body font-semibold">가로축(x) 변인</label>
                    <select
                      id="x-axis-column"
                      value={xName ?? ''}
                      onChange={(event) => changeXColumn(event.target.value)}
                      className="mt-2 w-full rounded-card border border-border bg-background p-2 text-body outline-none focus:border-accent"
                    >
                      {numericColumns.map((column) => (
                        <option key={column.name} value={column.name}>{column.name}</option>
                      ))}
                    </select>
                  </div>

                  {hasRepeats ? (
                    <div>
                      <label htmlFor="y-axis-column" className="text-body font-semibold">세로축(y) 변인</label>
                      <p className="mt-1 text-caption text-muted">
                        회차를 비교할 때는 변인 하나만 그립니다. 회차와 변인을 함께 겹치면 선이 너무 많아 어느 것이
                        무엇인지 읽을 수 없습니다.
                      </p>
                      <select
                        id="y-axis-column"
                        value={yNames[0] ?? ''}
                        onChange={(event) => setYNames([event.target.value])}
                        className="mt-2 w-full rounded-card border border-border bg-background p-2 text-body outline-none focus:border-accent"
                      >
                        {numericColumns
                          .filter((column) => column.name !== xName)
                          .map((column) => (
                            <option key={column.name} value={column.name}>{column.name}</option>
                          ))}
                      </select>
                    </div>
                  ) : (
                    <fieldset>
                      <legend className="text-body font-semibold">세로축(y) 변인</legend>
                      <p className="mt-1 text-caption text-muted">
                        최대 {MAX_SERIES}개까지 함께 그립니다. 단위가 다른 변인을 겹쳐 그리면 세로축 눈금이 한쪽에만
                        맞으니 단위가 같은 변인끼리 고르세요.
                      </p>
                      <div className="mt-2 space-y-2">
                        {numericColumns
                          .filter((column) => column.name !== xName)
                          .map((column) => {
                            const selectedAt = yNames.indexOf(column.name)
                            return (
                              <label key={column.name} className="flex items-center gap-2 text-body">
                                <input
                                  type="checkbox"
                                  checked={selectedAt >= 0}
                                  disabled={selectedAt < 0 && yNames.length >= MAX_SERIES}
                                  onChange={() => toggleYColumn(column.name)}
                                  className="size-4 accent-accent"
                                />
                                <span>{column.name}</span>
                                {selectedAt >= 0 && (
                                  <span className="text-caption text-muted">
                                    <span
                                      aria-hidden="true"
                                      className="mr-1 inline-block size-3 rounded-full align-middle"
                                      style={{ backgroundColor: seriesPaletteColors('variable')[selectedAt] }}
                                    />
                                    {SERIES_SHAPE_NAMES[selectedAt]} 표시
                                  </span>
                                )}
                              </label>
                            )
                          })}
                      </div>
                    </fieldset>
                  )}
                </div>

                {hasRepeats && (
                  <div className="mt-6 rounded-card border border-border p-4">
                    <fieldset>
                      <legend className="text-body font-semibold">회차 보기 방식</legend>
                      <div className="mt-2 space-y-2">
                        <label className="flex items-start gap-2 text-body">
                          <input
                            type="radio"
                            name="trial-view"
                            value="box"
                            checked={effectiveTrialView === 'box'}
                            onChange={() => setTrialView('box')}
                            className="mt-1 size-4 accent-accent"
                          />
                          <span>
                            상자그림으로 모아 보기
                            <span className="block text-caption text-muted">
                              같은 순번의 측정값을 모아 사분위수 상자와 최솟값·최댓값 수염으로 그립니다.
                            </span>
                          </span>
                        </label>
                        <label className="flex items-start gap-2 text-body">
                          <input
                            type="radio"
                            name="trial-view"
                            value="perTrial"
                            checked={effectiveTrialView === 'perTrial'}
                            disabled={tooManyTrialsForPerTrialView}
                            onChange={() => setTrialView('perTrial')}
                            className="mt-1 size-4 accent-accent"
                          />
                          <span>
                            회차별로 나누어 보기
                            <span className="block text-caption text-muted">
                              {tooManyTrialsForPerTrialView
                                ? `회차가 ${MAX_TRIAL_SERIES}개를 넘으면 색으로 구분할 수 없어 상자그림 보기만 쓸 수 있습니다.`
                                : '회차마다 다른 색과 점 모양으로 그려 실험이 되풀이되는지 봅니다.'}
                            </span>
                          </span>
                        </label>
                      </div>
                    </fieldset>

                    {effectiveTrialView === 'box' && (
                      <div className="mt-4 border-t border-border pt-4">
                        <label className="flex items-center gap-2 text-body">
                          <input
                            type="checkbox"
                            checked={showTrialPoints}
                            onChange={(event) => setShowTrialPoints(event.target.checked)}
                            className="size-4 accent-accent"
                          />
                          <span>회차별 측정값도 옅게 함께 표시</span>
                        </label>
                        <p className="mt-2 text-caption text-muted">
                          상자는 값의 절반이 모인 구간(제1~제3사분위수)이고, 가운데 굵은 선은 중앙값, 점은 평균입니다.
                          수염은 최솟값과 최댓값까지 뻗으므로 모든 측정값이 수염 안에 들어옵니다. 회차가 서너 번뿐이면
                          상자는 사실상 값이 퍼진 범위를 나타냅니다.
                        </p>
                      </div>
                    )}

                    {aggregate && effectiveTrialView === 'box' && (
                      <p className="mt-4 text-caption text-muted">
                        측정 순번 {aggregate.points.length.toLocaleString('ko-KR')}개 중{' '}
                        {aggregate.repeatedCount.toLocaleString('ko-KR')}개에서 두 회차 이상 측정되어 상자를 그릴 수
                        있습니다. 한 회차에서만 측정된 순번은 평균 점만 찍힙니다.
                      </p>
                    )}

                    {spreadWarning && (
                      <p role="alert" className="mt-2 rounded-card border border-warning bg-warning-background p-3 text-caption text-warning">
                        회차마다 가로축 값이 크게 다릅니다. 같은 순번끼리 모으는 방식이므로, 회차별로 다른 조건을
                        측정했다면 상자그림은 뜻을 잃습니다. 회차별로 나누어 보기로 먼저 확인하세요.
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-start gap-8">
                  <fieldset>
                    <legend className="text-body font-semibold">그래프 종류</legend>
                    <div className="mt-2 flex gap-4">
                      {([
                        { value: 'scatter', label: '산점도' },
                        { value: 'line', label: '꺾은선' },
                      ] as const).map((option) => (
                        <label key={option.value} className="flex items-center gap-2 text-body">
                          <input
                            type="radio"
                            name="chart-kind"
                            value={option.value}
                            checked={chartKind === option.value}
                            onChange={() => setChartKind(option.value)}
                            className="size-4 accent-accent"
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div>
                    <p className="text-body font-semibold">추세선</p>
                    <label className="mt-2 flex items-center gap-2 text-body">
                      <input
                        type="checkbox"
                        checked={showTrendLine}
                        disabled={!relation}
                        onChange={(event) => setShowTrendLine(event.target.checked)}
                        className="size-4 accent-accent"
                      />
                      <span>회귀직선 함께 그리기</span>
                    </label>
                    {!relation && (
                      <p className="mt-1 text-caption text-muted">
                        {hasRepeats
                          ? '상자그림 보기에서 회귀직선을 그릴 수 있습니다.'
                          : '세로축 변인을 하나만 고르면 회귀직선을 그릴 수 있습니다.'}
                      </p>
                    )}
                  </div>
                </div>

                {chartSeries.length === 0 ? (
                  <p className="mt-6 rounded-card border border-border bg-muted-background p-4 text-body text-muted">
                    세로축 변인을 하나 이상 고르면 그래프가 그려집니다.
                  </p>
                ) : (
                  <figure className="mt-6">
                    <div className="overflow-x-auto rounded-card border border-border bg-background p-3">
                      <div className="min-w-xl">
                        <DataChart
                          series={chartSeries}
                          xLabel={xColumn?.name ?? ''}
                          yLabel={yAxisLabel}
                          kind={chartKind}
                          trendLine={trendLine}
                          palette={hasRepeats && effectiveTrialView === 'perTrial' ? 'trial' : 'variable'}
                          contextPoints={contextPoints}
                          description={chartDescription}
                          chartRef={chartRef}
                        />
                      </div>
                    </div>
                    <figcaption className="mt-3 text-caption text-muted">{chartCaption}</figcaption>
                  </figure>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button onClick={() => void saveChartPng()} disabled={chartSeries.length === 0}>
                    그래프를 PNG 그림으로 저장
                  </Button>
                  <span className="text-caption text-muted">
                    {CHART_WIDTH * 2}×{CHART_HEIGHT * 2} 크기로 저장되어 보고서에 붙여도 글자가 또렷합니다.
                  </span>
                </div>

                {chartError && (
                  <p role="alert" className="mt-3 rounded-card border border-danger bg-danger-background p-4 text-danger">
                    {chartError}
                  </p>
                )}
              </>
            )}
          </section>

          {(relation || perTrialRelations.length > 0) && xColumn && yColumns[0] && (
            <section aria-labelledby="relation-step" className="mt-12">
              <h2 id="relation-step" className="text-heading font-semibold">4. 두 변인의 관계</h2>
              <p className="mt-2 text-body text-muted">
                가로축 {xColumn.name}, 세로축 {yColumns[0].name}의 관계를 최소제곱법으로 직선에 맞춘 결과입니다.
              </p>

              {relation && (
                <>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-card border border-border p-4">
                      <dt className="text-caption text-muted">회귀직선</dt>
                      <dd className="mt-1 text-body font-semibold">{formatRegressionEquation(relation)}</dd>
                    </div>
                    <div className="rounded-card border border-border p-4">
                      <dt className="text-caption text-muted">기울기</dt>
                      <dd className="mt-1 text-body font-semibold">{formatMeasurement(relation.slope)}</dd>
                    </div>
                    <div className="rounded-card border border-border p-4">
                      <dt className="text-caption text-muted">상관계수(r)</dt>
                      <dd className="mt-1 text-body font-semibold">
                        {relation.correlation === null ? '—' : formatMeasurement(relation.correlation)}
                      </dd>
                    </div>
                    <div className="rounded-card border border-border p-4">
                      <dt className="text-caption text-muted">직선이 측정값을 얼마나 잘 설명하는지 나타내는 값(R²)</dt>
                      <dd className="mt-1 text-body font-semibold">
                        {relation.determination === null ? '—' : formatMeasurement(relation.determination)}
                      </dd>
                    </div>
                  </dl>
                  {relation.correlation !== null && (
                    <p className="mt-4 text-body text-muted">
                      {describeCorrelation(relation.correlation)} 다만 r과 R²는 두 값이 함께 변한 정도만 알려 줄 뿐,
                      한쪽이 다른 쪽의 원인이라는 뜻은 아닙니다.
                    </p>
                  )}
                </>
              )}

              {perTrialRelations.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-body font-semibold">회차별 기울기 비교</h3>
                  <p className="mt-1 text-body text-muted">
                    회차마다 따로 맞춘 직선입니다. 기울기가 회차마다 크게 달라지면 실험 조건이 회차 사이에 바뀌었을 수
                    있습니다.
                  </p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full border-collapse text-caption">
                      <caption className="sr-only">회차별 회귀직선 비교</caption>
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th scope="col" className="py-2 pr-4 font-semibold">회차</th>
                          <th scope="col" className="py-2 pr-4 text-right font-semibold">개수(n)</th>
                          <th scope="col" className="py-2 pr-4 text-right font-semibold">기울기</th>
                          <th scope="col" className="py-2 pr-4 text-right font-semibold">절편</th>
                          <th scope="col" className="py-2 pr-4 text-right font-semibold">상관계수(r)</th>
                          <th scope="col" className="py-2 pr-4 text-right font-semibold">R²</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perTrialRelations.map((entry) => (
                          <tr key={entry.label} className="border-b border-border">
                            <th scope="row" className="py-2 pr-4 text-left font-medium whitespace-nowrap">{entry.label}</th>
                            {entry.relation === null ? (
                              <td colSpan={5} className="py-2 pr-4 text-right text-muted">직선을 맞출 수 없습니다</td>
                            ) : (
                              <>
                                <td className="py-2 pr-4 text-right tabular-nums">{entry.relation.count.toLocaleString('ko-KR')}</td>
                                <td className="py-2 pr-4 text-right tabular-nums">{formatMeasurement(entry.relation.slope)}</td>
                                <td className="py-2 pr-4 text-right tabular-nums">{formatMeasurement(entry.relation.intercept)}</td>
                                <td className="py-2 pr-4 text-right tabular-nums">
                                  {entry.relation.correlation === null ? '—' : formatMeasurement(entry.relation.correlation)}
                                </td>
                                <td className="py-2 pr-4 text-right tabular-nums">
                                  {entry.relation.determination === null ? '—' : formatMeasurement(entry.relation.determination)}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {slopeSpread && (
                    <p className="mt-3 text-body text-muted">
                      회차별 기울기의 평균은 {formatMeasurement(slopeSpread.mean)}이고, 표준편차는{' '}
                      {slopeSpread.standardDeviation === null ? '—' : formatMeasurement(slopeSpread.standardDeviation)}
                      입니다. 표준편차가 평균에 비해 작을수록 실험이 잘 되풀이된 것입니다.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          <section aria-labelledby="table-step" className="mt-12">
            <h2 id="table-step" className="text-heading font-semibold">5. 데이터 확인</h2>
            <p className="mt-2 text-body text-muted">
              그래프의 점 하나하나에 해당하는 값입니다. 전체 {totalRowCount.toLocaleString('ko-KR')}개 행 중 처음{' '}
              {Math.min(PREVIEW_ROW_LIMIT, totalRowCount)}개를 보여 줍니다. 나머지는 CSV 파일에서 확인하세요.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-caption">
                <caption className="sr-only">변환한 측정값 미리보기</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="py-2 pr-4 font-semibold">행</th>
                    {hasRepeats && <th scope="col" className="py-2 pr-4 font-semibold">{TRIAL_COLUMN_NAME}</th>}
                    {header.map((name) => (
                      <th key={name} scope="col" className="py-2 pr-4 text-right font-semibold whitespace-nowrap">{name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trials
                    .flatMap((trial) => trial.rows.map((row) => ({ trial, row })))
                    .slice(0, PREVIEW_ROW_LIMIT)
                    .map((entry, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-border">
                        <th scope="row" className="py-2 pr-4 text-left font-medium tabular-nums">{rowIndex + 1}</th>
                        {hasRepeats && <td className="py-2 pr-4 whitespace-nowrap">{entry.trial.label}</td>}
                        {header.map((name) => (
                          <td key={name} className="py-2 pr-4 text-right tabular-nums whitespace-nowrap">
                            {entry.row[entry.trial.header.indexOf(name)] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <p className="mt-12 text-caption text-muted">
        붙여넣은 내용은 이 브라우저 안에서만 계산되며 서버나 Firebase로 전송되지 않습니다.
      </p>
    </div>
  )
}
