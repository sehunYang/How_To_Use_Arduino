import { useCallback, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  DataChart,
  MAX_SERIES,
  SERIES_COLORS,
  SERIES_SHAPE_NAMES,
  type ChartKind,
  type ChartSeries,
} from '@/components/DataChart'
import { downloadChartPng } from '@/lib/chartExport'
import {
  collectNumericColumns,
  formatMeasurement,
  pairColumns,
  summarizeColumn,
  summarizeRelation,
  type NumericColumn,
  type RelationSummary,
} from '@/lib/dataStats'
import { convertSerialTextToCsv, downloadSerialCsv, type SerialCsvResult } from '@/lib/serialCsv'

const example = `time_ms,temperature_c,humidity_pct
0,21.5,48.2
1000,21.7,48.0`

const PREVIEW_ROW_LIMIT = 20

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
  const [result, setResult] = useState<SerialCsvResult | null>(null)
  const [xIndex, setXIndex] = useState<number | null>(null)
  const [yIndexes, setYIndexes] = useState<number[]>([])
  const [chartKind, setChartKind] = useState<ChartKind>('scatter')
  const [showTrendLine, setShowTrendLine] = useState(true)
  const [chartError, setChartError] = useState<string | null>(null)
  const chartRef = useRef<SVGSVGElement>(null)

  const numericColumns = useMemo(
    () => (result?.ok ? collectNumericColumns(result.header, result.rows) : []),
    [result],
  )

  const summaries = useMemo(
    () =>
      numericColumns.map((column) => ({
        column,
        summary: summarizeColumn(column.values.filter((value): value is number => value !== null)),
      })),
    [numericColumns],
  )

  const xColumn = numericColumns.find((column) => column.index === xIndex) ?? null
  const yColumns = useMemo(
    () =>
      yIndexes
        .map((index) => numericColumns.find((column) => column.index === index))
        .filter((column): column is NumericColumn => Boolean(column)),
    [yIndexes, numericColumns],
  )

  const chartSeries = useMemo<ChartSeries[]>(() => {
    if (!xColumn) return []
    return yColumns
      .map((column) => ({ key: String(column.index), label: column.name, points: pairColumns(xColumn, column) }))
      .filter((entry) => entry.points.length > 0)
  }, [xColumn, yColumns])

  const relation = useMemo(
    () => (chartSeries.length === 1 ? summarizeRelation(chartSeries[0].points) : null),
    [chartSeries],
  )

  const trendLine = useMemo(() => {
    if (!showTrendLine || !relation) return null
    const determination = relation.determination
    const annotation =
      determination === null
        ? formatRegressionEquation(relation)
        : `${formatRegressionEquation(relation)}, R² = ${formatMeasurement(determination)}`
    return { slope: relation.slope, intercept: relation.intercept, annotation }
  }, [showTrendLine, relation])

  function analyze() {
    const nextResult = convertSerialTextToCsv(input)
    setResult(nextResult)
    setChartError(null)

    if (!nextResult.ok) {
      setXIndex(null)
      setYIndexes([])
      return
    }

    // 아두이노 스케치는 보통 시간을 첫 열에 출력하므로 첫 측정값 열을 가로축으로 둡니다.
    const columns = collectNumericColumns(nextResult.header, nextResult.rows)
    setXIndex(columns[0]?.index ?? null)
    setYIndexes(columns[1] ? [columns[1].index] : [])
  }

  function reset() {
    setInput('')
    setResult(null)
    setXIndex(null)
    setYIndexes([])
    setChartError(null)
  }

  function changeXColumn(nextIndex: number) {
    setXIndex(nextIndex)
    // 같은 열을 두 축에 함께 쓰면 기울기 1인 직선만 그려져 얻을 정보가 없습니다.
    setYIndexes((indexes) => indexes.filter((index) => index !== nextIndex))
  }

  function toggleYColumn(index: number) {
    setYIndexes((indexes) =>
      indexes.includes(index)
        ? indexes.filter((value) => value !== index)
        : indexes.length >= MAX_SERIES
          ? indexes
          : [...indexes, index],
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

  const seriesLabels = chartSeries.map((entry) => entry.label).join(', ')
  const pointCount = chartSeries.reduce((total, entry) => total + entry.points.length, 0)
  const chartCaption = xColumn
    ? `그림 1. ${xColumn.name}에 따른 ${seriesLabels} (점 ${pointCount.toLocaleString('ko-KR')}개)`
    : ''
  const chartDescription = xColumn
    ? `가로축은 ${xColumn.name}, 세로축은 ${seriesLabels}인 ${chartKind === 'scatter' ? '산점도' : '꺾은선 그래프'}입니다. 점은 모두 ${pointCount.toLocaleString('ko-KR')}개입니다.`
    : ''

  return (
    <div className="mx-auto max-w-5xl py-8 md:py-12">
      <p className="text-caption font-semibold uppercase tracking-widest text-accent">시리얼 데이터 분석</p>
      <h1 className="mt-3 text-3xl font-semibold md:text-4xl">데이터 변환·분석</h1>
      <p className="mt-4 max-w-3xl text-body text-muted">
        Arduino IDE 시리얼 모니터에서 전체 내용을 복사해 붙여넣으세요. 첫 줄을 열 이름으로 사용해 CSV 파일로 저장하고,
        측정값의 요약 통계를 계산하고, 축을 골라 논문 형식 그래프로 그린 뒤 PNG 그림으로 내려받을 수 있습니다.
      </p>

      <section aria-labelledby="paste-step" className="mt-8">
        <h2 id="paste-step" className="text-heading font-semibold">1. 측정값 붙여넣기</h2>

        <div className="mt-4 rounded-card border border-border bg-muted-background p-5">
          <h3 className="text-body font-semibold">붙여넣기 형식</h3>
          <pre className="mt-3 overflow-x-auto whitespace-pre rounded-card border border-border bg-background p-4 text-caption"><code>{example}</code></pre>
          <p className="mt-3 text-caption text-muted">쉼표는 값과 값 사이에만 넣고, 각 행의 마지막에는 넣지 않습니다.</p>
        </div>

        <div className="mt-6">
          <label htmlFor="serial-data" className="text-body font-semibold">시리얼 모니터 내용</label>
          <textarea
            id="serial-data"
            value={input}
            onChange={(event) => {
              setInput(event.target.value)
              setResult(null)
            }}
            className="mt-2 min-h-64 w-full resize-y rounded-card border border-border bg-background p-4 font-mono text-caption outline-none focus:border-accent"
            placeholder="시리얼 모니터에서 Ctrl+A, Ctrl+C로 복사한 내용을 붙여넣으세요."
            spellCheck={false}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button size="lg" onClick={analyze} disabled={!input.trim()}>데이터 분석하기</Button>
          <Button size="lg" variant="outline" onClick={reset} disabled={!input && !result}>초기화</Button>
        </div>

        {result && !result.ok && (
          <div role="alert" className="mt-6 rounded-card border border-danger bg-danger-background p-4 text-danger">
            <p className="font-semibold">데이터를 읽을 수 없습니다.</p>
            <p className="mt-1">{result.error}</p>
          </div>
        )}

        {result?.ok && (
          <div className="mt-6 rounded-card border border-success bg-success-background p-4 text-success">
            <p role="status" className="font-semibold">
              {result.columnCount}개 열, {result.dataRowCount.toLocaleString('ko-KR')}개 데이터 행을 읽었습니다.
            </p>
            <p className="mt-1 text-caption">
              그중 숫자로 읽을 수 있는 측정값 열은 {numericColumns.length}개입니다.
            </p>
            <div className="mt-3">
              <Button variant="outline" onClick={() => downloadSerialCsv(result.csv)}>CSV 파일로 저장</Button>
            </div>
          </div>
        )}

        {result && result.excludedRows.length > 0 && (
          <aside aria-labelledby="excluded-rows" className="mt-4 rounded-card border border-warning bg-warning-background p-4 text-warning">
            <h3 id="excluded-rows" className="font-semibold">{result.excludedRows.length}개 행을 제외했습니다.</h3>
            <p className="mt-1 text-caption">제외된 행: {result.excludedRows.map((row) => row.lineNumber).join(', ')}</p>
            <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-caption">
              {result.excludedRows.map((row) => (
                <li key={row.lineNumber}>{row.lineNumber}번째 줄: {row.reason}</li>
              ))}
            </ul>
          </aside>
        )}
      </section>

      {result?.ok && (
        <>
          <section aria-labelledby="summary-step" className="mt-12">
            <h2 id="summary-step" className="text-heading font-semibold">2. 측정값 요약</h2>
            <p className="mt-2 text-body text-muted">
              각 측정값 열이 어떤 범위에 얼마나 퍼져 있는지 보여 줍니다. 표준편차는 반복 측정값이 평균에서 얼마나
              흩어져 있는지를 나타내고, 사분위수는 값을 크기순으로 늘어놓았을 때의 25%·50%·75% 지점입니다.
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
                      {SUMMARY_COLUMNS.map((column) => (
                        <th key={column.key} scope="col" className="py-2 pr-4 text-right font-semibold whitespace-nowrap">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summaries.map(({ column, summary }) => (
                      <tr key={column.index} className="border-b border-border">
                        <th scope="row" className="py-2 pr-4 text-left font-medium whitespace-nowrap">{column.name}</th>
                        {SUMMARY_COLUMNS.map((summaryColumn) => {
                          const value = summary?.[summaryColumn.key] ?? null
                          return (
                            <td key={summaryColumn.key} className="py-2 pr-4 text-right tabular-nums whitespace-nowrap">
                              {value === null ? '—' : formatMeasurement(value)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="chart-step" className="mt-12">
            <h2 id="chart-step" className="text-heading font-semibold">3. 그래프 그리기</h2>
            <p className="mt-2 text-body text-muted">
              가로축과 세로축에 놓을 변인을 고르세요. 그래프는 흰 바탕·검은 축의 논문 그림 형식으로 그려지며,
              화면 테마와 상관없이 항상 같은 모습으로 저장됩니다.
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
                      value={xIndex ?? ''}
                      onChange={(event) => changeXColumn(Number(event.target.value))}
                      className="mt-2 w-full rounded-card border border-border bg-background p-2 text-body outline-none focus:border-accent"
                    >
                      {numericColumns.map((column) => (
                        <option key={column.index} value={column.index}>{column.name}</option>
                      ))}
                    </select>
                  </div>

                  <fieldset>
                    <legend className="text-body font-semibold">세로축(y) 변인</legend>
                    <p className="mt-1 text-caption text-muted">
                      최대 {MAX_SERIES}개까지 함께 그립니다. 단위가 다른 변인을 겹쳐 그리면 세로축 눈금이 한쪽에만 맞으니
                      단위가 같은 변인끼리 고르세요.
                    </p>
                    <div className="mt-2 space-y-2">
                      {numericColumns
                        .filter((column) => column.index !== xIndex)
                        .map((column) => {
                          const selectedAt = yIndexes.indexOf(column.index)
                          return (
                            <label key={column.index} className="flex items-center gap-2 text-body">
                              <input
                                type="checkbox"
                                checked={selectedAt >= 0}
                                disabled={selectedAt < 0 && yIndexes.length >= MAX_SERIES}
                                onChange={() => toggleYColumn(column.index)}
                                className="size-4 accent-accent"
                              />
                              <span>{column.name}</span>
                              {selectedAt >= 0 && (
                                <span className="text-caption text-muted">
                                  <span
                                    aria-hidden="true"
                                    className="mr-1 inline-block size-3 rounded-full align-middle"
                                    style={{ backgroundColor: SERIES_COLORS[selectedAt] }}
                                  />
                                  {SERIES_SHAPE_NAMES[selectedAt]} 표시
                                </span>
                              )}
                            </label>
                          )
                        })}
                    </div>
                  </fieldset>
                </div>

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
                      <p className="mt-1 text-caption text-muted">세로축 변인을 하나만 고르면 회귀직선을 그릴 수 있습니다.</p>
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
                          yLabel={seriesLabels}
                          kind={chartKind}
                          trendLine={trendLine}
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

          {relation && xColumn && (
            <section aria-labelledby="relation-step" className="mt-12">
              <h2 id="relation-step" className="text-heading font-semibold">4. 두 변인의 관계</h2>
              <p className="mt-2 text-body text-muted">
                가로축 {xColumn.name}, 세로축 {chartSeries[0].label}의 관계를 최소제곱법으로 직선에 맞춘 결과입니다.
              </p>
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
            </section>
          )}

          <section aria-labelledby="table-step" className="mt-12">
            <h2 id="table-step" className="text-heading font-semibold">5. 데이터 확인</h2>
            <p className="mt-2 text-body text-muted">
              그래프의 점 하나하나에 해당하는 값입니다. 전체 {result.dataRowCount.toLocaleString('ko-KR')}개 행 중
              처음 {Math.min(PREVIEW_ROW_LIMIT, result.dataRowCount)}개를 보여 줍니다. 나머지는 CSV 파일에서 확인하세요.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-caption">
                <caption className="sr-only">변환한 측정값 미리보기</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="py-2 pr-4 font-semibold">행</th>
                    {result.header.map((name) => (
                      <th key={name} scope="col" className="py-2 pr-4 text-right font-semibold whitespace-nowrap">{name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, PREVIEW_ROW_LIMIT).map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-border">
                      <th scope="row" className="py-2 pr-4 text-left font-medium tabular-nums">{rowIndex + 1}</th>
                      {row.map((field, fieldIndex) => (
                        <td key={fieldIndex} className="py-2 pr-4 text-right tabular-nums whitespace-nowrap">{field}</td>
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
