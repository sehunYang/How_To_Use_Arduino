/**
 * 값의 크기를 색으로 나타낸 격자 표.
 *
 * 교실 격자의 조도 분포나 8지점 광량처럼 **어디가 밝고 어디가 어두운지**를 보는
 * 탐구는 꺾은선이 아니라 놓인 자리 그대로의 표로 읽어야 합니다.
 *
 * 색은 거들 뿐입니다. 값은 언제나 숫자로 함께 적어, 색을 구별하기 어려운 사람도
 * 같은 결론에 이르도록 했습니다.
 */
import { formatMeasurement } from '@/lib/dataStats'

export interface GridCell {
  label: string
  value: number | null
}

export interface GridSummaryProps {
  cells: readonly GridCell[]
  /** 한 줄에 놓을 칸 수. 센서를 놓은 격자의 가로 칸 수와 맞춥니다. */
  columns: number
  caption: string
}

export function GridSummary({ cells, columns, caption }: GridSummaryProps) {
  const values = cells.map((cell) => cell.value).filter((value): value is number => value !== null)
  const min = values.length > 0 ? Math.min(...values) : 0
  const max = values.length > 0 ? Math.max(...values) : 0
  const span = max - min

  const rows: GridCell[][] = []
  for (let index = 0; index < cells.length; index += columns) {
    rows.push(cells.slice(index, index + columns))
  }

  return (
    <table className="w-full table-fixed border-collapse text-caption">
      <caption className="sr-only">{caption}</caption>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell) => {
              // 가장 작은 값도 옅게나마 보이도록 0.08부터 시작합니다.
              const strength = cell.value === null || span === 0 ? 0.4 : 0.08 + ((cell.value - min) / span) * 0.62
              return (
                <td
                  key={cell.label}
                  className="border border-border p-2 text-center align-middle"
                  style={{ backgroundColor: `rgb(42 120 214 / ${strength})` }}
                >
                  <span className="block text-caption font-medium">{cell.label}</span>
                  <span className="block tabular-nums">
                    {cell.value === null ? '—' : formatMeasurement(cell.value)}
                  </span>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
