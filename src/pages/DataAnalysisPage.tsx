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
import { GridSummary, type GridCell } from '@/components/GridSummary'
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
import {
  FUNCTION_HELP,
  buildColumns,
  compileExpression,
  validateColumnName,
  type CalculatedColumn,
} from '@/lib/derivedColumns'
import { collectGroupColumns, pivotByColumn, splitRowsByColumn } from '@/lib/seriesGrouping'
import { EMPTY_RANGE, cropRows, hasRange, type RowRange } from '@/lib/rowRange'
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
/** 격자 표는 칸이 이만큼은 있어야 분포로 읽힙니다. */
const MIN_GRID_CELLS = 3

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

type TrialView = 'box' | 'perTrial' | 'merged'
type SummaryMark = 'box' | 'errorBar'

/** 회차마다 사람이 적어 넣는 조건 값을 함께 들고 다니는 회차. */
interface PageTrial extends Trial {
  manualValues: Record<string, string>
}

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
  const [trials, setTrials] = useState<PageTrial[]>([])
  const [lastResult, setLastResult] = useState<SerialCsvResult | null>(null)
  const [mismatchError, setMismatchError] = useState<string | null>(null)
  const [xName, setXName] = useState<string | null>(null)
  const [yNames, setYNames] = useState<string[]>([])
  const [chartKind, setChartKind] = useState<ChartKind>('scatter')
  const [trialView, setTrialView] = useState<TrialView>('box')
  /**
   * 모아 볼 때 퍼진 정도를 무엇으로 그릴지. 상자그림은 값이 어떻게 놓였는지를
   * 그대로 보여 주고, 오차막대는 보고서 그림에서 쓰는 평균±표준편차 표시입니다.
   * 탐구 가이드가 "오차막대로 표시하라"고 시키는 레시피가 있어 둘 다 둡니다.
   */
  const [summaryMark, setSummaryMark] = useState<SummaryMark>('box')
  const [showTrialPoints, setShowTrialPoints] = useState(true)
  const [showTrendLine, setShowTrendLine] = useState(true)
  const [chartError, setChartError] = useState<string | null>(null)
  /**
   * 기본은 붙여넣고 바로 그래프를 보는 화면입니다. 구간 자르기·열 더하기처럼 손이
   * 더 가는 기능은 고급으로 바꿀 때만 나타납니다. 대부분의 탐구는 붙여넣기만으로
   * 끝나는데, 그 사람들에게까지 식 입력란을 먼저 보여 주면 화면이 어려워 보입니다.
   */
  const [level, setLevel] = useState<'basic' | 'advanced'>('basic')
  const [range, setRange] = useState<RowRange>(EMPTY_RANGE)
  /** 회차마다 값을 적어 넣는 열의 이름. 값 자체는 회차가 들고 있습니다. */
  const [manualNames, setManualNames] = useState<string[]>([])
  const [calculatedColumns, setCalculatedColumns] = useState<CalculatedColumn[]>([])
  const [groupName, setGroupName] = useState<string>('')
  const [spreadToColumns, setSpreadToColumns] = useState(false)
  const [gridMeasure, setGridMeasure] = useState<string>('')
  const [gridWidth, setGridWidth] = useState(4)
  const [draftManualName, setDraftManualName] = useState('')
  const [draftCalculatedName, setDraftCalculatedName] = useState('')
  const [draftExpression, setDraftExpression] = useState('')
  const [manualNameError, setManualNameError] = useState<string | null>(null)
  const [calculatedError, setCalculatedError] = useState<string | null>(null)
  /**
   * 붙여넣은 회차는 이 화면 안에만 있고 어디에도 저장되지 않습니다. 잘못 지우면 실험을
   * 여러 번 되풀이해 모은 값이 사라지므로, 지우기 전 상태를 한 벌 들고 있다가 되돌릴 수
   * 있게 합니다. 지우기 전에 한 번 더 묻는 대신 이렇게 한 이유는, 지우기는 자주 하는 일이라
   * 매번 확인을 받으면 성가시고 결국 읽지 않고 누르게 되기 때문입니다.
   */
  const [undoable, setUndoable] = useState<{
    input: string
    trials: PageTrial[]
    xName: string | null
    yNames: string[]
    manualNames: string[]
    calculatedColumns: CalculatedColumn[]
  } | null>(null)
  const chartRef = useRef<SVGSVGElement>(null)

  const advanced = level === 'advanced'
  const hasRepeats = trials.length >= 2

  // ── 붙여넣은 표를 다듬는 차례: 구간 자르기 → 계열 펼치기 → 열 더하기 ──
  const croppedTrials = useMemo(
    () => trials.map((trial) => ({ ...trial, rows: cropRows(trial.header, trial.rows, range) })),
    [trials, range],
  )
  const rawHeader = useMemo(() => croppedTrials[0]?.header ?? [], [croppedTrials])
  const rawRows = useMemo(() => croppedTrials.flatMap((trial) => trial.rows), [croppedTrials])
  const croppedAway = trials.reduce((total, trial) => total + trial.rows.length, 0) - rawRows.length

  const groupCandidates = useMemo(() => collectGroupColumns(rawHeader, rawRows), [rawHeader, rawRows])
  const activeGroupName = groupCandidates.some((candidate) => candidate.name === groupName) ? groupName : ''
  const pivotActive = advanced && spreadToColumns && activeGroupName !== ''

  /**
   * 다듬기를 마친 표. 이 아래의 요약·그래프·저장은 모두 이 표만 보므로, 더한 열도
   * 시리얼에서 온 열과 똑같이 다뤄집니다.
   */
  const builtTrials = useMemo(
    () =>
      croppedTrials.map((trial) => {
        const base = pivotActive
          ? pivotByColumn(trial.header, trial.rows, activeGroupName)
          : { header: trial.header, rows: trial.rows }
        const manual = manualNames.map((name) => ({ name, value: trial.manualValues[name] ?? '' }))
        const built = buildColumns(base.header, base.rows, manual, calculatedColumns)
        return { ...trial, header: built.header, rows: built.rows, errors: built.errors }
      }),
    [croppedTrials, pivotActive, activeGroupName, manualNames, calculatedColumns],
  )

  const header = useMemo(() => builtTrials[0]?.header ?? [], [builtTrials])
  const combinedRows = useMemo(() => builtTrials.flatMap((trial) => trial.rows), [builtTrials])
  const totalRowCount = combinedRows.length
  const expressionErrors = builtTrials[0]?.errors ?? {}

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
          ? builtTrials.map((trial) => ({
              label: trial.label,
              summary: summarizeColumn(
                readNamedColumn(trial.header, trial.rows, column.name).filter(
                  (value): value is number => value !== null,
                ),
              ),
            }))
          : [],
      })),
    [numericColumns, builtTrials, hasRepeats],
  )

  // 고른 열이 사라져도(계산 열을 지웠을 때) 그래프가 조용히 없어지지 않게 첫 열로 되돌립니다.
  const xColumn = numericColumns.find((column) => column.name === xName) ?? numericColumns[0] ?? null
  const yColumns = useMemo(
    () =>
      yNames
        .map((name) => numericColumns.find((column) => column.name === name))
        .filter((column): column is NumericColumn => Boolean(column)),
    [yNames, numericColumns],
  )

  const groups = useMemo(
    () => (activeGroupName && !pivotActive ? splitRowsByColumn(header, combinedRows, activeGroupName) : []),
    [activeGroupName, pivotActive, header, combinedRows],
  )
  const usesGrouping = groups.length >= 2 && Boolean(xColumn) && yColumns.length === 1
  /** 계열을 나눌 때도, 회차를 견줄 때도 세로축 변인은 하나만 그립니다. */
  const singleVariableOnly = hasRepeats || usesGrouping

  /** 회차마다 가로축·세로축 값을 이름으로 찾아 짝지은 점 목록 */
  const trialPoints = useMemo(() => {
    if (!xColumn || yColumns.length !== 1) return []
    const yColumn = yColumns[0]
    return builtTrials.map((trial) =>
      pairValues(
        readNamedColumn(trial.header, trial.rows, xColumn.name),
        readNamedColumn(trial.header, trial.rows, yColumn.name),
      ),
    )
  }, [builtTrials, xColumn, yColumns])

  const groupPoints = useMemo(() => {
    if (!usesGrouping || !xColumn) return []
    const yColumn = yColumns[0]
    return groups.map((group) =>
      pairValues(
        readNamedColumn(header, group.rows, xColumn.name),
        readNamedColumn(header, group.rows, yColumn.name),
      ),
    )
  }, [usesGrouping, groups, header, xColumn, yColumns])

  const aggregate = useMemo(
    () => (!usesGrouping && hasRepeats && trialPoints.length > 0 ? aggregateByOrder(trialPoints) : null),
    [usesGrouping, hasRepeats, trialPoints],
  )

  /**
   * 회차가 색으로 구분할 수 있는 수를 넘으면 고른 값과 관계없이 평균 보기로 그립니다.
   * 라디오 버튼만 막아 두면 회차를 더하다가 한계를 넘었을 때 화면이 조용히 잘린 그래프를
   * 보여 주게 됩니다.
   */
  const tooManyTrialsForPerTrialView = trials.length > MAX_TRIAL_SERIES
  const effectiveTrialView: TrialView =
    tooManyTrialsForPerTrialView && trialView === 'perTrial' ? 'box' : trialView
  const usesBoxView = !usesGrouping && hasRepeats && effectiveTrialView === 'box'
  /**
   * 회차 하나가 조건 하나인 실험은 회차를 갈라 놓으면 조건을 관통하는 직선을 얻을 수
   * 없습니다. 실 길이별 주기처럼 회차마다 점 하나씩을 얻는 탐구가 여기에 해당하므로,
   * 회차를 모두 합쳐 한 계열로 보는 방식을 함께 둡니다.
   */
  const usesMergedView = !usesGrouping && hasRepeats && effectiveTrialView === 'merged'

  const chartSeries = useMemo<ChartSeries[]>(() => {
    if (!xColumn) return []

    if (usesGrouping) {
      return groups
        .map((group, index) => ({
          key: group.value,
          label: `${activeGroupName} ${group.value}`,
          points: groupPoints[index] ?? [],
        }))
        .filter((entry) => entry.points.length > 0)
    }

    if (usesBoxView && aggregate) {
      const points: ChartPoint[] = aggregate.points.map((point) => ({
        x: point.x,
        y: point.y,
        box: summaryMark === 'box' && point.count >= 2
          ? {
              min: point.min,
              quartile1: point.quartile1,
              median: point.median,
              quartile3: point.quartile3,
              max: point.max,
            }
          : null,
        // 회차가 하나뿐인 순번은 퍼진 정도를 정할 수 없어 막대를 그리지 않습니다.
        errorBar: summaryMark === 'errorBar' ? point.standardDeviation : null,
        note: summaryMark === 'errorBar'
          ? `${point.count}회 측정 · 평균 ${formatMeasurement(point.y)}${
              point.standardDeviation === null ? '' : ` · 표준편차 ${formatMeasurement(point.standardDeviation)}`
            }`
          : `${point.count}회 측정 · 중앙값 ${formatMeasurement(point.median)} · 범위 ${formatMeasurement(point.min)}~${formatMeasurement(point.max)}`,
      }))
      return points.length > 0 ? [{ key: 'box', label: `${trials.length}회 요약`, points }] : []
    }

    if (usesMergedView) {
      const points = trialPoints.flat()
      return points.length > 0 ? [{ key: 'merged', label: `${trials.length}회차 전체`, points }] : []
    }

    if (hasRepeats) {
      return builtTrials
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
  }, [xColumn, yColumns, usesGrouping, groups, groupPoints, activeGroupName, usesBoxView, summaryMark, usesMergedView, aggregate, hasRepeats, builtTrials, trials.length, trialPoints])

  const contextPoints = useMemo<MeasurementPoint[] | undefined>(
    () => (usesBoxView && showTrialPoints ? trialPoints.flat() : undefined),
    [usesBoxView, showTrialPoints, trialPoints],
  )

  /** 회귀직선은 그래프에 실제로 그려진 계열이 하나일 때만 뜻이 있습니다. */
  const relation = useMemo(
    () => (chartSeries.length === 1 ? summarizeRelation(chartSeries[0].points) : null),
    [chartSeries],
  )

  /**
   * 계열마다 따로 맞춘 직선. 회차를 견줄 때는 실험이 되풀이되는지 보는 표가 되고,
   * 열 값으로 나눌 때는 조건별 기울기(저항, 재료, 채널)를 견주는 표가 됩니다.
   */
  const comparison = useMemo(() => {
    if (usesGrouping) {
      return {
        label: activeGroupName,
        heading: `${activeGroupName} 값별 기울기 비교`,
        description: `${activeGroupName} 값마다 따로 맞춘 직선입니다.`,
        entries: groups.map((group, index) => ({
          label: group.value,
          relation: summarizeRelation(groupPoints[index] ?? []),
        })),
      }
    }
    if (hasRepeats) {
      return {
        label: TRIAL_COLUMN_NAME,
        heading: '회차별 기울기 비교',
        description: '회차마다 따로 맞춘 직선입니다.',
        entries: builtTrials.map((trial, index) => ({
          label: trial.label,
          relation: summarizeRelation(trialPoints[index] ?? []),
        })),
      }
    }
    return null
  }, [usesGrouping, activeGroupName, groups, groupPoints, hasRepeats, builtTrials, trialPoints])

  const slopeSpread = useMemo(() => {
    const slopes = (comparison?.entries ?? [])
      .map((entry) => entry.relation?.slope)
      .filter((slope): slope is number => slope !== undefined)
    return slopes.length >= 2 ? summarizeColumn(slopes) : null
  }, [comparison])

  const trendLine = useMemo(() => {
    if (!showTrendLine || !relation) return null
    const determination = relation.determination
    const annotation =
      determination === null
        ? formatRegressionEquation(relation)
        : `${formatRegressionEquation(relation)}, R² = ${formatMeasurement(determination)}`
    return { slope: relation.slope, intercept: relation.intercept, annotation }
  }, [showTrendLine, relation])

  /**
   * 격자 표에 놓을 칸. 계열을 나누는 열이 있으면 그 값마다 한 칸, 없으면 측정값 열마다
   * 한 칸입니다. 앞은 교실 격자 조도, 뒤는 8지점 광량 같은 자료를 위한 것입니다.
   */
  const gridCells = useMemo<GridCell[]>(() => {
    if (usesGrouping) {
      const measure = numericColumns.find((column) => column.name === gridMeasure)
        ?? numericColumns.find((column) => column.name !== xColumn?.name && column.name !== activeGroupName)
      if (!measure) return []
      return groups.map((group) => ({
        label: `${activeGroupName} ${group.value}`,
        value: summarizeColumn(
          readNamedColumn(header, group.rows, measure.name).filter((value): value is number => value !== null),
        )?.mean ?? null,
      }))
    }
    return numericColumns
      .filter((column) => column.name !== xColumn?.name)
      .map((column) => ({
        label: column.name,
        value: summarizeColumn(column.values.filter((value): value is number => value !== null))?.mean ?? null,
      }))
  }, [usesGrouping, groups, activeGroupName, gridMeasure, numericColumns, xColumn, header])

  const showGrid = advanced && gridCells.length >= MIN_GRID_CELLS
  const showRelation = Boolean((relation || comparison) && xColumn && yColumns[0])

  /**
   * 절 번호는 실제로 화면에 있는 절만 세어 붙입니다. 고급 기능을 켜지 않으면 "구간과 열
   * 다듬기" 절이 없는데, 번호를 고정해 두면 3번 다음에 5번이 오는 목차가 됩니다.
   */
  const sectionKeys = [
    'paste',
    ...(trials.length > 0 ? ['summary'] : []),
    ...(trials.length > 0 && advanced ? ['columns'] : []),
    ...(trials.length > 0 ? ['chart'] : []),
    ...(showRelation ? ['relation'] : []),
    ...(showGrid ? ['grid'] : []),
    ...(trials.length > 0 ? ['table'] : []),
  ]
  const sectionNumber = (key: string) => sectionKeys.indexOf(key) + 1

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

    const nextTrials: PageTrial[] = [
      ...trials,
      {
        id: (trials.at(-1)?.id ?? 0) + 1,
        label: trialLabel(trials.length + 1),
        header: parsed.header,
        rows: parsed.rows,
        manualValues: {},
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
    if (input || trials.length > 0) {
      setUndoable({ input, trials, xName, yNames, manualNames, calculatedColumns })
    }
    setInput('')
    setTrials([])
    setLastResult(null)
    setMismatchError(null)
    setXName(null)
    setYNames([])
    setChartError(null)
    setManualNames([])
    setCalculatedColumns([])
    setGroupName('')
    setRange(EMPTY_RANGE)
    setSpreadToColumns(false)
  }

  function undoReset() {
    if (!undoable) return
    setInput(undoable.input)
    setTrials(undoable.trials)
    setXName(undoable.xName)
    setYNames(undoable.yNames)
    setManualNames(undoable.manualNames)
    setCalculatedColumns(undoable.calculatedColumns)
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

  function addManualColumn() {
    const name = draftManualName.trim()
    const error = validateColumnName(name, header)
    if (error) {
      setManualNameError(error)
      return
    }
    setManualNames((names) => [...names, name])
    setDraftManualName('')
    setManualNameError(null)
  }

  function removeManualColumn(name: string) {
    setManualNames((names) => names.filter((value) => value !== name))
    setTrials((current) =>
      current.map((trial) => ({
        ...trial,
        manualValues: Object.fromEntries(
          Object.entries(trial.manualValues).filter(([key]) => key !== name),
        ),
      })),
    )
  }

  function setManualValue(trialId: number, name: string, value: string) {
    setTrials((current) =>
      current.map((trial) =>
        trial.id === trialId ? { ...trial, manualValues: { ...trial.manualValues, [name]: value } } : trial,
      ),
    )
  }

  function addCalculatedColumn() {
    const name = draftCalculatedName.trim()
    const nameError = validateColumnName(name, header)
    if (nameError) {
      setCalculatedError(nameError)
      return
    }
    const compiled = compileExpression(draftExpression, header)
    if (!compiled.ok) {
      setCalculatedError(compiled.error)
      return
    }
    setCalculatedColumns((columns) => [...columns, { name, expression: draftExpression.trim() }])
    setDraftCalculatedName('')
    setDraftExpression('')
    setCalculatedError(null)
  }

  function removeCalculatedColumn(name: string) {
    setCalculatedColumns((columns) => columns.filter((column) => column.name !== name))
  }

  function changeGroupColumn(nextName: string) {
    setGroupName(nextName)
    // 계열을 나누면 변인을 하나만 그리므로 선택을 미리 하나로 줄입니다.
    if (nextName) setYNames((names) => names.slice(0, 1))
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
    if (builtTrials.length === 0) return
    if (builtTrials.length === 1) {
      downloadSerialCsv(buildCsv(builtTrials[0].header, builtTrials[0].rows))
      return
    }
    // 회차를 구분할 수 없는 CSV는 반복 실험 기록으로 쓸 수 없으므로 회차 열을 앞에 붙입니다.
    const rows = builtTrials.flatMap((trial) =>
      trial.rows.map((row) => [trial.label, ...header.map((name) => row[trial.header.indexOf(name)] ?? '')]),
    )
    downloadSerialCsv(buildCsv([TRIAL_COLUMN_NAME, ...header], rows))
  }

  const seriesLabels = chartSeries.map((entry) => entry.label).join(', ')
  const pointCount = chartSeries.reduce((total, entry) => total + entry.points.length, 0)
  const yAxisLabel = singleVariableOnly ? (yColumns[0]?.name ?? '') : seriesLabels
  const usesErrorBars = usesBoxView && summaryMark === 'errorBar'
  /** 그림 설명에서 표시를 부르는 이름. 캡션과 낭독 설명이 서로 어긋나지 않게 한곳에서 정합니다. */
  const summaryMarkName = usesErrorBars ? '오차막대' : '상자'
  const boxNote = !usesBoxView
    ? ''
    : usesErrorBars
      ? ' 점은 회차별 값의 평균이고, 오차막대는 평균 위아래로 표준편차 한 배씩입니다.'
      : ' 상자는 제1사분위수부터 제3사분위수까지이고, 가운데 굵은 선은 중앙값, 점은 평균, 수염은 최솟값과 최댓값입니다.'
  const chartCaption = xColumn
    ? `그림 1. ${xColumn.name}에 따른 ${yAxisLabel} (${usesGrouping ? `${activeGroupName}별 ${groups.length}계열, ` : hasRepeats ? `${trials.length}회 반복, ` : ''}${usesBoxView ? summaryMarkName : '점'} ${pointCount.toLocaleString('ko-KR')}개).${boxNote}`
    : ''
  const chartDescription = xColumn
    ? `가로축은 ${xColumn.name}, 세로축은 ${yAxisLabel}인 ${chartKind === 'scatter' ? '산점도' : '꺾은선 그래프'}입니다. ${
        usesBoxView
          ? `${trials.length}개 회차의 값을 측정 순번마다 ${usesErrorBars ? '평균과 오차막대로' : '상자그림으로'} 그렸습니다.`
          : `계열은 ${seriesLabels}입니다.`
      } ${usesBoxView ? `${summaryMarkName}는` : '점은'} 모두 ${pointCount.toLocaleString('ko-KR')}개입니다.`
    : ''

  // 이미 회차를 합쳐 보고 있다면 회차 사이가 벌어졌다는 경고는 알려 줄 것이 없습니다.
  const spreadWarning = !usesMergedView && aggregate && aggregate.worstSpreadRatio > MAX_TRUSTWORTHY_SPREAD_RATIO

  /**
   * 기본 화면에서도, 자료가 고급 기능을 부르고 있을 때는 그 사실만 한 줄로 알려 줍니다.
   * 기능을 미리 펼쳐 두는 대신 필요한 순간에만 문을 열어 주는 것입니다.
   */
  const suggestion = !advanced && trials.length > 0
    ? numericColumns.length < 2
      ? '숫자로 읽을 수 있는 열이 하나뿐입니다. 직접 잰 값을 열로 더하면 가로축이 생깁니다.'
      : spreadWarning
        ? '회차마다 가로축 값이 크게 다릅니다. 조건 값을 열로 더해 가로축에 놓을 수 있습니다.'
        : null
    : null

  return (
    <div className="mx-auto max-w-5xl py-8 md:py-12">
      <h1 className="text-3xl font-semibold md:text-4xl">데이터 변환·분석</h1>
      <p className="mt-3 max-w-3xl text-body text-muted">
        시리얼 모니터 내용을 붙여넣으면 요약 통계와 그래프가 바로 나옵니다.
      </p>

      <section aria-labelledby="paste-step" className="mt-8">
        <h2 id="paste-step" className="text-heading font-semibold">{sectionNumber('paste')}. 측정값 붙여넣기</h2>

        <details className="mt-4 rounded-card border border-border bg-muted-background p-4">
          <summary className="cursor-pointer text-caption font-semibold">붙여넣기 형식 보기</summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre rounded-card border border-border bg-background p-4 text-caption"><code>{example}</code></pre>
        </details>

        <div className="mt-4">
          <label htmlFor="serial-data" className="text-body font-semibold">시리얼 모니터 내용</label>
          <textarea
            id="serial-data"
            value={input}
            onChange={(event) => {
              setInput(event.target.value)
              setLastResult(null)
              setMismatchError(null)
            }}
            className="mt-2 min-h-64 w-full resize-y rounded-card border border-border bg-background p-4 font-mono text-caption focus:border-accent"
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
            <p className="mt-1 text-caption">
              숫자 열 {numericColumns.length}개
              {croppedAway > 0 && ` · 구간 자르기로 ${croppedAway.toLocaleString('ko-KR')}개 행 제외`}
            </p>
            {/* 행 수는 실제로 분석에 쓰인 수를 보여 줍니다. 구간을 자른 뒤에도 원래
                행 수가 남아 있으면 위의 합계와 어긋나 보입니다. */}
            <ul className="mt-3 flex flex-wrap gap-2">
              {builtTrials.map((trial) => (
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
          <div className="mt-10 rounded-card border border-border bg-muted-background p-4">
            <fieldset>
              <legend className="text-body font-semibold">분석 방식</legend>
              <div className="mt-2 flex flex-wrap gap-6">
                {([
                  { value: 'basic', label: '기본' },
                  { value: 'advanced', label: '고급 (구간 자르기 · 열 더하기 · 격자)' },
                ] as const).map((option) => (
                  <label key={option.value} className="flex items-center gap-2 text-body">
                    <input
                      type="radio"
                      name="analysis-level"
                      value={option.value}
                      checked={level === option.value}
                      onChange={() => setLevel(option.value)}
                      className="size-4 accent-accent"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          {suggestion && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-card border border-warning bg-warning-background p-4 text-warning">
              <p className="grow text-caption">{suggestion}</p>
              <Button size="sm" onClick={() => setLevel('advanced')}>고급 기능 켜기</Button>
            </div>
          )}

          <section aria-labelledby="summary-step" className="mt-12">
            <h2 id="summary-step" className="text-heading font-semibold">{sectionNumber('summary')}. 측정값 요약</h2>

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

          {advanced && (
            <section aria-labelledby="columns-step" className="mt-12">
              <h2 id="columns-step" className="text-heading font-semibold">{sectionNumber('columns')}. 구간과 열 다듬기</h2>

              <div className="mt-4 rounded-card border border-border p-5">
                <h3 className="text-body font-semibold">구간 자르기</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="range-column" className="text-caption font-medium">기준 열</label>
                    <select
                      id="range-column"
                      value={range.column}
                      onChange={(event) => setRange((current) => ({ ...current, column: event.target.value }))}
                      className="mt-1 w-full rounded-card border border-border bg-background p-2 text-body focus:border-accent"
                    >
                      <option value="">자르지 않기</option>
                      {rawHeader.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="range-min" className="text-caption font-medium">이 값부터</label>
                    <input
                      id="range-min"
                      value={range.min}
                      onChange={(event) => setRange((current) => ({ ...current, min: event.target.value }))}
                      disabled={!range.column}
                      placeholder="비우면 처음부터"
                      className="mt-1 w-full rounded-card border border-border bg-background p-2 text-body tabular-nums focus:border-accent"
                    />
                  </div>
                  <div>
                    <label htmlFor="range-max" className="text-caption font-medium">이 값까지</label>
                    <input
                      id="range-max"
                      value={range.max}
                      onChange={(event) => setRange((current) => ({ ...current, max: event.target.value }))}
                      disabled={!range.column}
                      placeholder="비우면 끝까지"
                      className="mt-1 w-full rounded-card border border-border bg-background p-2 text-body tabular-nums focus:border-accent"
                    />
                  </div>
                </div>
                {hasRange(range) && (
                  <p role="status" className="mt-3 text-caption text-muted">
                    {rawRows.length.toLocaleString('ko-KR')}개 행이 남았고 {croppedAway.toLocaleString('ko-KR')}개 행을
                    뺐습니다.
                  </p>
                )}
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="rounded-card border border-border p-5">
                  <h3 className="text-body font-semibold">조건 값 열</h3>
                  <p className="mt-1 text-caption text-muted">회차마다 직접 잰 값 하나를 적어 넣습니다.</p>

                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <div className="grow">
                      <label htmlFor="manual-column-name" className="text-caption font-medium">새 열 이름</label>
                      <input
                        id="manual-column-name"
                        value={draftManualName}
                        onChange={(event) => {
                          setDraftManualName(event.target.value)
                          setManualNameError(null)
                        }}
                        placeholder="예: 실_길이_m"
                        className="mt-1 w-full rounded-card border border-border bg-background p-2 text-body focus:border-accent"
                      />
                    </div>
                    <Button onClick={addManualColumn} disabled={!draftManualName.trim()}>열 만들기</Button>
                  </div>
                  {manualNameError && (
                    <p role="alert" className="mt-2 text-caption text-danger">{manualNameError}</p>
                  )}

                  {manualNames.length > 0 && (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full border-collapse text-caption">
                        <caption className="sr-only">회차별 조건 값</caption>
                        <thead>
                          <tr className="border-b border-border text-left">
                            <th scope="col" className="py-2 pr-4 font-semibold">회차</th>
                            {manualNames.map((name) => (
                              <th key={name} scope="col" className="py-2 pr-4 font-semibold whitespace-nowrap">
                                {name}
                                <button
                                  onClick={() => removeManualColumn(name)}
                                  className="ml-2 rounded-card px-1 font-semibold text-muted hover:text-danger"
                                  aria-label={`${name} 열 빼기`}
                                >
                                  ×
                                </button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {trials.map((trial) => (
                            <tr key={trial.id} className="border-b border-border">
                              <th scope="row" className="py-2 pr-4 text-left font-medium whitespace-nowrap">{trial.label}</th>
                              {manualNames.map((name) => (
                                <td key={name} className="py-2 pr-4">
                                  <input
                                    value={trial.manualValues[name] ?? ''}
                                    onChange={(event) => setManualValue(trial.id, name, event.target.value)}
                                    aria-label={`${trial.label}의 ${name}`}
                                    className="w-28 rounded-card border border-border bg-background p-1 text-caption tabular-nums focus:border-accent"
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="rounded-card border border-border p-5">
                  <h3 className="text-body font-semibold">계산 열</h3>
                  <p className="mt-1 text-caption text-muted">
                    열 이름과 숫자를 <code>+ - * / ^</code>와 괄호로 엮습니다. 예:{' '}
                    <code>diff(distance_m)/diff(time_ms)*1000</code>
                  </p>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label htmlFor="calculated-column-name" className="text-caption font-medium">새 열 이름</label>
                      <input
                        id="calculated-column-name"
                        value={draftCalculatedName}
                        onChange={(event) => {
                          setDraftCalculatedName(event.target.value)
                          setCalculatedError(null)
                        }}
                        placeholder="예: ln_온도차"
                        className="mt-1 w-full rounded-card border border-border bg-background p-2 text-body focus:border-accent"
                      />
                    </div>
                    <div>
                      <label htmlFor="calculated-column-expression" className="text-caption font-medium">식</label>
                      <input
                        id="calculated-column-expression"
                        value={draftExpression}
                        onChange={(event) => {
                          setDraftExpression(event.target.value)
                          setCalculatedError(null)
                        }}
                        placeholder="예: ln(excess_temperature_c)"
                        spellCheck={false}
                        className="mt-1 w-full rounded-card border border-border bg-background p-2 font-mono text-caption focus:border-accent"
                      />
                    </div>
                    <Button onClick={addCalculatedColumn} disabled={!draftCalculatedName.trim() || !draftExpression.trim()}>
                      열 만들기
                    </Button>
                  </div>
                  {calculatedError && (
                    <p role="alert" className="mt-2 text-caption text-danger">{calculatedError}</p>
                  )}

                  <div className="mt-4">
                    <p className="text-caption font-medium">쓸 수 있는 열 이름</p>
                    <p className="mt-1 break-words font-mono text-caption text-muted">{header.join(', ')}</p>
                  </div>

                  <details className="mt-3">
                    <summary className="cursor-pointer text-caption font-medium">쓸 수 있는 함수</summary>
                    <ul className="mt-2 space-y-1 text-caption text-muted">
                      {FUNCTION_HELP.map((entry) => (
                        <li key={entry.name}><code>{entry.usage}</code> — {entry.meaning}</li>
                      ))}
                    </ul>
                  </details>

                  {calculatedColumns.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {calculatedColumns.map((column) => (
                        <li key={column.name} className="flex items-start gap-2 rounded-card border border-border p-2 text-caption">
                          <span className="grow">
                            <b>{column.name}</b> = <code>{column.expression}</code>
                            {expressionErrors[column.name] && (
                              <span role="alert" className="mt-1 block text-danger">{expressionErrors[column.name]}</span>
                            )}
                          </span>
                          <button
                            onClick={() => removeCalculatedColumn(column.name)}
                            className="rounded-card px-1 font-semibold text-muted hover:text-danger"
                            aria-label={`${column.name} 열 빼기`}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {activeGroupName && (
                <div className="mt-6 rounded-card border border-border p-5">
                  <h3 className="text-body font-semibold">계열을 열로 펼치기</h3>
                  <label className="mt-2 flex items-start gap-2 text-body">
                    <input
                      type="checkbox"
                      checked={spreadToColumns}
                      onChange={(event) => setSpreadToColumns(event.target.checked)}
                      className="mt-1 size-4 accent-accent"
                    />
                    <span>
                      {activeGroupName} 값마다 열을 따로 만들기
                      <span className="block text-caption text-muted">
                        <code>측정값_{groupCandidates.find((candidate) => candidate.name === activeGroupName)?.values[0] ?? '0'}</code>{' '}
                        같은 열이 생겨 계열끼리 빼는 계산을 할 수 있습니다.
                      </span>
                    </span>
                  </label>
                </div>
              )}
            </section>
          )}

          <section aria-labelledby="chart-step" className="mt-12">
            <h2 id="chart-step" className="text-heading font-semibold">{sectionNumber('chart')}. 그래프 그리기</h2>

            {numericColumns.length < 2 ? (
              <p className="mt-4 rounded-card border border-border bg-muted-background p-4 text-body text-muted">
                그래프를 그리려면 숫자 열이 두 개 이상 필요합니다.
              </p>
            ) : (
              <>
                <div className="mt-4 grid gap-6 md:grid-cols-2">
                  <div>
                    <label htmlFor="x-axis-column" className="text-body font-semibold">가로축(x) 변인</label>
                    <select
                      id="x-axis-column"
                      value={xColumn?.name ?? ''}
                      onChange={(event) => changeXColumn(event.target.value)}
                      className="mt-2 w-full rounded-card border border-border bg-background p-2 text-body focus:border-accent"
                    >
                      {numericColumns.map((column) => (
                        <option key={column.name} value={column.name}>{column.name}</option>
                      ))}
                    </select>
                  </div>

                  {singleVariableOnly ? (
                    <div>
                      <label htmlFor="y-axis-column" className="text-body font-semibold">세로축(y) 변인</label>
                      <p className="mt-1 text-caption text-muted">
                        {usesGrouping ? '계열을 나눌 때는' : '회차를 비교할 때는'} 변인 하나만 그립니다.
                      </p>
                      <select
                        id="y-axis-column"
                        value={yColumns[0]?.name ?? ''}
                        onChange={(event) => setYNames([event.target.value])}
                        className="mt-2 w-full rounded-card border border-border bg-background p-2 text-body focus:border-accent"
                      >
                        {numericColumns
                          .filter((column) => column.name !== xColumn?.name)
                          .map((column) => (
                            <option key={column.name} value={column.name}>{column.name}</option>
                          ))}
                      </select>
                    </div>
                  ) : (
                    <fieldset>
                      <legend className="text-body font-semibold">세로축(y) 변인</legend>
                      <p className="mt-1 text-caption text-muted">
                        단위가 같은 변인끼리 최대 {MAX_SERIES}개.
                      </p>
                      <div className="mt-2 space-y-2">
                        {numericColumns
                          .filter((column) => column.name !== xColumn?.name)
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

                {/*
                  센서를 여러 개 단 레시피는 한 행씩 번갈아 출력하므로, 나누지 않으면
                  이웃한 점이 서로 다른 센서가 되어 톱니만 남습니다. 그런 자료가
                  들어왔을 때만 이 선택이 나타납니다.
                */}
                {groupCandidates.length > 0 && !pivotActive && (
                  <div className="mt-6 rounded-card border border-border p-4">
                    <label htmlFor="group-column" className="text-body font-semibold">계열 나누기 기준</label>
                    <p className="mt-1 text-caption text-muted">고른 열의 값마다 계열을 하나씩 그립니다.</p>
                    <select
                      id="group-column"
                      value={activeGroupName}
                      onChange={(event) => changeGroupColumn(event.target.value)}
                      className="mt-2 w-full rounded-card border border-border bg-background p-2 text-body focus:border-accent md:w-80"
                    >
                      <option value="">나누지 않기</option>
                      {groupCandidates.map((candidate) => (
                        <option key={candidate.name} value={candidate.name}>
                          {candidate.name} ({candidate.values.length}가지)
                        </option>
                      ))}
                    </select>
                    {activeGroupName && groups.length > MAX_SERIES && (
                      <p role="alert" className="mt-2 rounded-card border border-warning bg-warning-background p-3 text-caption text-warning">
                        {activeGroupName} 값이 {groups.length}가지라 색으로 구분할 수 있는 {MAX_SERIES}가지까지만 그립니다.
                        그리지 못한 값: {groups.slice(MAX_SERIES).map((group) => group.value).join(', ')}
                      </p>
                    )}
                    {activeGroupName && yColumns.length !== 1 && (
                      <p className="mt-2 text-caption text-muted">세로축 변인을 하나 고르면 계열이 나뉩니다.</p>
                    )}
                  </div>
                )}

                {hasRepeats && !usesGrouping && (
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
                            <span className="block text-caption text-muted">같은 조건을 되풀이해 잰 회차</span>
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
                                ? `회차 ${MAX_TRIAL_SERIES}개까지만 색으로 나눌 수 있습니다`
                                : '회차마다 조건을 바꿔 잰 경우'}
                            </span>
                          </span>
                        </label>
                        <label className="flex items-start gap-2 text-body">
                          <input
                            type="radio"
                            name="trial-view"
                            value="merged"
                            checked={effectiveTrialView === 'merged'}
                            onChange={() => setTrialView('merged')}
                            className="mt-1 size-4 accent-accent"
                          />
                          <span>
                            회차를 합쳐 한 계열로 보기
                            <span className="block text-caption text-muted">회차 하나가 점 하나가 되는 경우</span>
                          </span>
                        </label>
                      </div>
                    </fieldset>

                    {effectiveTrialView === 'box' && (
                      <div className="mt-4 space-y-4 border-t border-border pt-4">
                        <fieldset>
                          <legend className="text-body font-semibold">퍼진 정도를 그리는 방법</legend>
                          <div className="mt-2 space-y-2">
                            {([
                              {
                                value: 'box',
                                label: '상자그림',
                                hint: '값이 실제로 어떻게 놓였는지 그대로 보여 줍니다',
                              },
                              {
                                value: 'errorBar',
                                label: '오차막대 (평균 ± 표준편차)',
                                hint: '탐구 보고서 그림에서 가장 많이 쓰는 표시입니다',
                              },
                            ] as const).map((option) => (
                              <label key={option.value} className="flex items-start gap-2 text-body">
                                <input
                                  type="radio"
                                  name="summary-mark"
                                  value={option.value}
                                  checked={summaryMark === option.value}
                                  onChange={() => setSummaryMark(option.value)}
                                  className="mt-1 size-4 accent-accent"
                                />
                                <span>
                                  {option.label}
                                  <span className="block text-caption text-muted">{option.hint}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <label className="flex items-center gap-2 text-body">
                          <input
                            type="checkbox"
                            checked={showTrialPoints}
                            onChange={(event) => setShowTrialPoints(event.target.checked)}
                            className="size-4 accent-accent"
                          />
                          <span>회차별 측정값도 옅게 함께 표시</span>
                        </label>
                      </div>
                    )}

                    {aggregate && effectiveTrialView === 'box' && (
                      <p className="mt-4 text-caption text-muted">
                        측정 순번 {aggregate.points.length.toLocaleString('ko-KR')}개 중{' '}
                        {aggregate.repeatedCount.toLocaleString('ko-KR')}개에서 두 회차 이상 측정되어{' '}
                        {summaryMark === 'errorBar' ? '오차막대를' : '상자를'} 그릴 수 있습니다.
                      </p>
                    )}

                    {spreadWarning && (
                      <p role="alert" className="mt-2 rounded-card border border-warning bg-warning-background p-3 text-caption text-warning">
                        회차마다 가로축 값이 크게 다릅니다. 회차마다 조건을 바꿔 쟀다면 위에서 다른 보기 방식을 고르세요.
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
                        {usesGrouping
                          ? '계열마다의 직선은 아래 비교 표에 있습니다.'
                          : hasRepeats
                            ? '상자그림 보기나 합쳐 보기에서 그릴 수 있습니다.'
                            : '세로축 변인을 하나만 고르면 그릴 수 있습니다.'}
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
                          palette={hasRepeats && !usesGrouping && effectiveTrialView === 'perTrial' ? 'trial' : 'variable'}
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
                  <span className="text-caption text-muted">{CHART_WIDTH * 2}×{CHART_HEIGHT * 2}px</span>
                </div>

                {chartError && (
                  <p role="alert" className="mt-3 rounded-card border border-danger bg-danger-background p-4 text-danger">
                    {chartError}
                  </p>
                )}
              </>
            )}
          </section>

          {showRelation && xColumn && yColumns[0] && (
            <section aria-labelledby="relation-step" className="mt-12">
              <h2 id="relation-step" className="text-heading font-semibold">{sectionNumber('relation')}. 두 변인의 관계</h2>
              <p className="mt-2 text-body text-muted">
                {xColumn.name} · {yColumns[0].name}을 최소제곱법으로 직선에 맞춘 결과입니다.
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
                      <dt className="text-caption text-muted">설명력(R²)</dt>
                      <dd className="mt-1 text-body font-semibold">
                        {relation.determination === null ? '—' : formatMeasurement(relation.determination)}
                      </dd>
                    </div>
                  </dl>
                  {relation.correlation !== null && (
                    <p className="mt-4 text-body text-muted">
                      {describeCorrelation(relation.correlation)} 다만 인과관계를 뜻하지는 않습니다.
                    </p>
                  )}
                </>
              )}

              {comparison && (
                <div className="mt-8">
                  <h3 className="text-body font-semibold">{comparison.heading}</h3>
                  <p className="mt-1 text-body text-muted">{comparison.description}</p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full border-collapse text-caption">
                      <caption className="sr-only">계열별 회귀직선 비교</caption>
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th scope="col" className="py-2 pr-4 font-semibold">{comparison.label}</th>
                          <th scope="col" className="py-2 pr-4 text-right font-semibold">개수(n)</th>
                          <th scope="col" className="py-2 pr-4 text-right font-semibold">기울기</th>
                          <th scope="col" className="py-2 pr-4 text-right font-semibold">절편</th>
                          <th scope="col" className="py-2 pr-4 text-right font-semibold">상관계수(r)</th>
                          <th scope="col" className="py-2 pr-4 text-right font-semibold">R²</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparison.entries.map((entry) => (
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
                      {comparison.label}별 기울기의 평균은 {formatMeasurement(slopeSpread.mean)}이고, 표준편차는{' '}
                      {slopeSpread.standardDeviation === null ? '—' : formatMeasurement(slopeSpread.standardDeviation)}
                      입니다.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {showGrid && (
            <section aria-labelledby="grid-step" className="mt-12">
              <h2 id="grid-step" className="text-heading font-semibold">{sectionNumber('grid')}. 격자로 보기</h2>
              <p className="mt-2 max-w-3xl text-body text-muted">센서를 놓은 자리 그대로 평균값을 늘어놓습니다.</p>

              <div className="mt-4 flex flex-wrap items-end gap-4">
                {usesGrouping && (
                  <div>
                    <label htmlFor="grid-measure" className="text-caption font-medium">보여 줄 측정값</label>
                    <select
                      id="grid-measure"
                      value={gridMeasure}
                      onChange={(event) => setGridMeasure(event.target.value)}
                      className="mt-1 w-56 rounded-card border border-border bg-background p-2 text-body focus:border-accent"
                    >
                      {numericColumns
                        .filter((column) => column.name !== xColumn?.name && column.name !== activeGroupName)
                        .map((column) => (
                          <option key={column.name} value={column.name}>{column.name}</option>
                        ))}
                    </select>
                  </div>
                )}
                <div>
                  <label htmlFor="grid-width" className="text-caption font-medium">한 줄에 놓을 칸 수</label>
                  <input
                    id="grid-width"
                    type="number"
                    min={1}
                    max={8}
                    value={gridWidth}
                    onChange={(event) => setGridWidth(Math.min(8, Math.max(1, Number(event.target.value) || 1)))}
                    className="mt-1 w-24 rounded-card border border-border bg-background p-2 text-body tabular-nums focus:border-accent"
                  />
                </div>
              </div>

              <div className="mt-4">
                <GridSummary cells={gridCells} columns={gridWidth} caption="측정 위치별 평균값 격자" />
              </div>
            </section>
          )}

          <section aria-labelledby="table-step" className="mt-12">
            <h2 id="table-step" className="text-heading font-semibold">{sectionNumber('table')}. 데이터 확인</h2>
            <p className="mt-2 text-body text-muted">
              전체 {totalRowCount.toLocaleString('ko-KR')}개 행 중 처음 {Math.min(PREVIEW_ROW_LIMIT, totalRowCount)}개.
              나머지는 CSV 파일에 들어 있습니다.
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
                  {builtTrials
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
        붙여넣은 내용은 이 브라우저 밖으로 나가지 않습니다.
      </p>
    </div>
  )
}
