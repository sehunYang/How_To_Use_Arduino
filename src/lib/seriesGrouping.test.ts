import { describe, expect, it } from 'vitest'
import { collectGroupColumns, pivotByColumn, splitRowsByColumn } from '@/lib/seriesGrouping'

/** 센서를 여러 개 단 레시피는 한 행씩 번갈아 출력합니다(S9, e5, e6, ph11, ph13). */
const HEADER = ['time_ms', 'channel', 'light_raw']
const ROWS = [
  ['0', '0', '8200'],
  ['120', '1', '2400'],
  ['500', '0', '8180'],
  ['620', '1', '2380'],
  ['1000', '0', '8210'],
  ['1120', '1', '2420'],
]

describe('collectGroupColumns', () => {
  it('offers the column whose values repeat and skips the ones that change every row', () => {
    expect(collectGroupColumns(HEADER, ROWS)).toEqual([{ name: 'channel', values: ['0', '1'] }])
  })

  it('offers a condition name column and sorts its values as words', () => {
    const header = ['condition_id', 'bus_V', 'current_mA']
    const rows = [
      ['R1K', '1', '1'],
      ['R2K2', '1', '0.5'],
      ['R1K', '2', '2'],
      ['R2K2', '2', '0.9'],
      ['R1K', '3', '3'],
      ['R2K2', '3', '1.4'],
    ]
    expect(collectGroupColumns(header, rows)).toEqual([{ name: 'condition_id', values: ['R1K', 'R2K2'] }])
  })

  it('sorts numeric values by size, not as text', () => {
    const rows = Array.from({ length: 30 }, (_unused, index) => ['0', String(index % 3 === 0 ? 10 : index % 3 === 1 ? 2 : 1), '5'])
    expect(collectGroupColumns(['time_ms', 'index', 'v'], rows)[0].values).toEqual(['1', '2', '10'])
  })

  it('skips a column that has only one value', () => {
    const rows = ROWS.map((row) => [row[0], '0', row[2]])
    expect(collectGroupColumns(HEADER, rows)).toEqual([])
  })
})

describe('splitRowsByColumn', () => {
  it('gathers the rows of each sensor so one series holds one sensor', () => {
    const groups = splitRowsByColumn(HEADER, ROWS, 'channel')

    expect(groups.map((group) => group.value)).toEqual(['0', '1'])
    expect(groups[0].rows.map((row) => row[2])).toEqual(['8200', '8180', '8210'])
    expect(groups[1].rows.map((row) => row[2])).toEqual(['2400', '2380', '2420'])
  })

  it('leaves out the rows whose grouping value is empty', () => {
    const groups = splitRowsByColumn(HEADER, [...ROWS, ['1500', '', '9999']], 'channel')
    expect(groups.flatMap((group) => group.rows)).toHaveLength(6)
  })

  it('gives nothing back for a column that is not there', () => {
    expect(splitRowsByColumn(HEADER, ROWS, 'position')).toEqual([])
  })
})

describe('pivotByColumn', () => {
  /** 같은 시각 두 지점의 온도 차는 값이 세로로 번갈아 쌓여 있는 한 만들 수 없습니다. */
  it('lays each sensor out in its own column so the two can be subtracted', () => {
    const pivoted = pivotByColumn(HEADER, ROWS, 'channel')

    expect(pivoted.header).toEqual(['time_ms_0', 'light_raw_0', 'time_ms_1', 'light_raw_1'])
    expect(pivoted.rows).toEqual([
      ['0', '8200', '120', '2400'],
      ['500', '8180', '620', '2380'],
      ['1000', '8210', '1120', '2420'],
    ])
  })

  /** 한 계열이 한 행 더 길게 끝나는 일은 흔합니다. 짝이 없는 행은 버립니다. */
  it('stops at the shortest series so no row is left half empty', () => {
    const pivoted = pivotByColumn(HEADER, [...ROWS, ['1500', '0', '8190']], 'channel')
    expect(pivoted.rows).toHaveLength(3)
  })

  it('leaves the table alone when there is nothing to spread', () => {
    const rows = ROWS.map((row) => [row[0], '0', row[2]])
    expect(pivotByColumn(HEADER, rows, 'channel')).toEqual({ header: HEADER, rows })
  })
})
