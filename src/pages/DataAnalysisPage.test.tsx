// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DataAnalysisPage } from './DataAnalysisPage'

const RUN_1 = 'time_ms,temperature_c,humidity_pct{enter}0,20,50{enter}1000,22,48{enter}2000,24,46'
const RUN_2 = 'time_ms,temperature_c,humidity_pct{enter}0,22,51{enter}1000,24,49{enter}2000,26,47'

type User = ReturnType<typeof userEvent.setup>

async function paste(user: User, text: string) {
  const textarea = screen.getByLabelText('시리얼 모니터 내용')
  await user.clear(textarea)
  await user.type(textarea, text)
  await user.click(screen.getByRole('button', { name: /데이터 분석하기|회차로 추가하기/ }))
}

describe('DataAnalysisPage', () => {
  let createObjectUrl: ReturnType<typeof vi.fn>
  let anchorClick: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    createObjectUrl = vi.fn(() => 'blob:serial-csv')
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  })

  afterEach(() => {
    anchorClick.mockRestore()
    cleanup()
  })

  it('reports the parsed shape and saves a BOM-prefixed CSV only when asked', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await paste(user, RUN_1)

    expect(screen.getByRole('status')).toHaveTextContent('1개 회차, 3개 열, 모두 3개 데이터 행')
    expect(createObjectUrl).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'CSV 파일로 저장' }))

    const blob = createObjectUrl.mock.calls[0][0] as Blob
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder().decode(bytes)).toBe(
      'time_ms,temperature_c,humidity_pct\r\n0,20,50\r\n1000,22,48\r\n2000,24,46',
    )
  })

  it('summarises every numeric column', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await paste(user, RUN_1)

    const summaryRow = screen.getByRole('row', { name: /^temperature_c/ })
    const cells = within(summaryRow).getAllByRole('cell').map((cell) => cell.textContent)
    // 개수 · 평균 · 표준편차 · 최솟값 … 최댓값 · 범위
    expect([cells[0], cells[1], cells[2], cells[3], cells[7], cells[8]]).toEqual(['3', '22', '2', '20', '24', '4'])
  })

  it('plots the first two numeric columns and lets the axes be changed', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await paste(user, RUN_1)

    expect(screen.getByRole('img')).toHaveAccessibleName(/가로축은 time_ms, 세로축은 temperature_c인 산점도/)
    expect(screen.getByText(/그림 1\. time_ms에 따른 temperature_c/)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('가로축(x) 변인'), 'temperature_c')

    // 세로축에 있던 변인을 가로축으로 옮겼으므로 두 축이 맞바뀝니다.
    expect(screen.queryByRole('checkbox', { name: /temperature_c/ })).not.toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAccessibleName(/가로축은 temperature_c, 세로축은 time_ms/)
  })

  it('fits a regression line and explains the relationship', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await paste(user, RUN_1)

    const relation = screen.getByRole('region', { name: '4. 두 변인의 관계' })
    expect(within(relation).getByText('y = 0.002x + 20')).toBeInTheDocument()
    // 온도가 시간에 정확히 비례하는 표본이라 상관계수와 R²가 모두 1입니다.
    expect(within(relation).getAllByText('1')).toHaveLength(2)
    expect(within(relation).getByText(/관계가 매우 뚜렷합니다/)).toBeInTheDocument()
  })

  it('switches the chart to a line and drops the trend line for several variables', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await paste(user, RUN_1)

    await user.click(screen.getByRole('radio', { name: '꺾은선' }))
    expect(screen.getByRole('img')).toHaveAccessibleName(/꺾은선 그래프/)

    await user.click(screen.getByRole('checkbox', { name: /humidity_pct/ }))
    expect(screen.getByRole('checkbox', { name: '회귀직선 함께 그리기' })).toBeDisabled()
    expect(screen.queryByRole('region', { name: '4. 두 변인의 관계' })).not.toBeInTheDocument()
  })

  it('does not analyse invalid input and reports the excluded line numbers', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await paste(user, 'time_ms,value{enter}0{enter}1000')

    expect(screen.getByRole('alert')).toHaveTextContent('저장할 수 있는 데이터 행이 없습니다')
    expect(screen.getByText('제외된 행: 2, 3')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('clears the pasted text and every derived view', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await paste(user, RUN_1)

    await user.click(screen.getByRole('button', { name: '전체 지우기' }))

    expect(screen.getByLabelText('시리얼 모니터 내용')).toHaveValue('')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  /**
   * 붙여넣은 회차는 이 화면 안에만 있고 어디에도 저장되지 않습니다. 실수로 지웠을 때
   * 되돌릴 수 없다면 실험을 여러 번 되풀이해 모은 값이 그대로 사라집니다.
   */
  it('takes the clearing back so a mistaken click does not cost the measurements', async () => {
    const user = userEvent.setup()
    render(<DataAnalysisPage />)
    await paste(user, RUN_1)

    await user.click(screen.getByRole('button', { name: '전체 지우기' }))
    await user.click(screen.getByRole('button', { name: '되돌리기' }))

    expect(screen.getByRole('status')).toHaveTextContent('1개 회차')
    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '되돌리기' })).not.toBeInTheDocument()
  })

  /**
   * 이 묶음은 회차를 여러 번 붙여넣고 그때마다 그래프를 다시 그립니다. 한 건에 3~5초가
   * 걸려 기본 제한 5초에 아슬아슬하게 걸쳐 있었고, 전체 테스트를 한꺼번에 돌려 기계가
   * 바쁠 때마다 무작위로 끊겼습니다. 느린 것이지 잘못된 것이 아니므로 시간을 넉넉히 줍니다.
   */
  describe('반복 실험', { timeout: 30_000 }, () => {
    it('empties the box after each run so the next one can be pasted straight in', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)

      expect(screen.getByLabelText('시리얼 모니터 내용')).toHaveValue('')
      expect(screen.getByRole('button', { name: '2회차로 추가하기' })).toBeDisabled()
    })

    it('draws the runs as a box plot at each measurement position', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)
      await paste(user, RUN_2)

      expect(screen.getByRole('status')).toHaveTextContent('2개 회차, 3개 열, 모두 6개 데이터 행')
      expect(screen.getByRole('img')).toHaveAccessibleName(/2개 회차의 값을 측정 순번마다 상자그림으로 그렸습니다/)
      expect(screen.getByText(/상자는 제1사분위수부터 제3사분위수까지이고/)).toBeInTheDocument()
      expect(screen.getByText(/측정 순번 3개 중 3개에서 두 회차 이상 측정되어 상자를 그릴 수 있습니다/)).toBeInTheDocument()

      // 회차별 행이 측정값마다 함께 실립니다.
      const summary = screen.getByRole('region', { name: '2. 측정값 요약' })
      expect(within(summary).getAllByRole('row', { name: /^1회차/ })).toHaveLength(3)
      expect(within(summary).getAllByRole('row', { name: /^2회차/ })).toHaveLength(3)
    })

    it('draws one series per run when asked to compare them', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)
      await paste(user, RUN_2)

      await user.click(screen.getByRole('radio', { name: /회차별로 나누어 보기/ }))

      expect(screen.getByRole('img')).toHaveAccessibleName(/계열은 1회차, 2회차입니다/)
      const relation = screen.getByRole('region', { name: '4. 두 변인의 관계' })
      const perTrial = within(relation).getByRole('row', { name: /^1회차/ })
      expect(within(perTrial).getAllByRole('cell')[1]).toHaveTextContent('0.002')
      expect(within(relation).getByText(/회차별 기울기의 평균은 0.002이고, 표준편차는 0입니다/)).toBeInTheDocument()
    })

    it('adds a trial column to the CSV so the runs stay apart', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)
      await paste(user, RUN_2)

      await user.click(screen.getByRole('button', { name: 'CSV 파일로 저장' }))
      const blob = createObjectUrl.mock.calls[0][0] as Blob
      const text = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()))

      // TextDecoder는 앞머리 BOM을 떼고 읽으므로 여기서는 열 이름부터 비교합니다.
      expect(text).toBe(
        '회차,time_ms,temperature_c,humidity_pct\r\n'
        + '1회차,0,20,50\r\n1회차,1000,22,48\r\n1회차,2000,24,46\r\n'
        + '2회차,0,22,51\r\n2회차,1000,24,49\r\n2회차,2000,26,47',
      )
    })

    it('refuses a run whose columns do not match the first one', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)
      await paste(user, 'time_ms,lux{enter}0,300{enter}1000,320')

      expect(screen.getByRole('alert')).toHaveTextContent('빠진 열: temperature_c, humidity_pct')
      expect(screen.getByRole('alert')).toHaveTextContent('처음 보는 열: lux')
      expect(screen.getByRole('status')).toHaveTextContent('1개 회차')
    })

    it('renumbers the remaining runs when one is taken out', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)
      await paste(user, RUN_2)

      await user.click(screen.getByRole('button', { name: '1회차 빼기' }))

      expect(screen.getByRole('status')).toHaveTextContent('1개 회차')
      expect(screen.getByRole('button', { name: '2회차로 추가하기' })).toBeInTheDocument()
    })
  })
  /**
   * 기본 화면은 붙여넣고 바로 그래프를 보는 자리입니다. 손이 더 가는 기능을 먼저
   * 펼쳐 두면, 그것 없이 끝나는 대부분의 탐구에까지 화면이 어려워 보입니다.
   */
  describe('분석 방식', { timeout: 30_000 }, () => {
    it('keeps the heavier tools out of sight until they are asked for', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)

      expect(screen.queryByRole('region', { name: /구간과 열 다듬기/ })).not.toBeInTheDocument()
      expect(screen.queryByLabelText('식')).not.toBeInTheDocument()
      // 붙여넣기만으로 끝나는 화면이라 요약과 그래프는 그대로 있습니다.
      expect(screen.getByRole('region', { name: '2. 측정값 요약' })).toBeInTheDocument()
      expect(screen.getByRole('img')).toBeInTheDocument()

      await user.click(screen.getByRole('radio', { name: /고급/ }))

      expect(screen.getByRole('region', { name: '3. 구간과 열 다듬기' })).toBeInTheDocument()
      expect(screen.getByLabelText('식')).toBeInTheDocument()
    })

    /** 자료가 고급 기능을 부르고 있을 때만 그 사실을 한 줄로 알려 줍니다. */
    it('offers to open the advanced tools when the pasted data needs them', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, 'time_ms,mode{enter}0,켬{enter}1000,끔{enter}2000,켬')

      expect(screen.getByText(/숫자로 읽을 수 있는 열이 하나뿐/)).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: '고급 기능 켜기' }))

      expect(screen.getByRole('region', { name: '3. 구간과 열 다듬기' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '고급 기능 켜기' })).not.toBeInTheDocument()
    })

    it('says nothing extra when the data is already enough to draw', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)

      expect(screen.queryByRole('button', { name: '고급 기능 켜기' })).not.toBeInTheDocument()
    })
  })

  /**
   * 레시피가 요구하는 그래프는 대부분 시리얼에 없는 값을 가로축으로 씁니다. 실의 길이나
   * 편광판 각도는 사람이 재어 적고, 온도 차의 로그는 측정값에서 계산해야 나옵니다.
   */
  describe('열 더하기', { timeout: 30_000 }, () => {
    it('adds a condition value per run and fits one line through the runs', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)
      await paste(user, RUN_2)
      await user.click(screen.getByRole('radio', { name: /고급/ }))

      await user.type(screen.getByLabelText('새 열 이름', { selector: '#manual-column-name' }), '실_길이_m')
      await user.click(screen.getAllByRole('button', { name: '열 만들기' })[0])
      await user.type(screen.getByLabelText('1회차의 실_길이_m'), '0.2')
      await user.type(screen.getByLabelText('2회차의 실_길이_m'), '0.4')

      await user.selectOptions(screen.getByLabelText('가로축(x) 변인'), '실_길이_m')
      await user.selectOptions(screen.getByLabelText('세로축(y) 변인'), 'temperature_c')
      await user.click(screen.getByRole('radio', { name: /회차를 합쳐 한 계열로 보기/ }))

      expect(screen.getByRole('img')).toHaveAccessibleName(/가로축은 실_길이_m, 세로축은 temperature_c/)
      const relation = screen.getByRole('region', { name: '5. 두 변인의 관계' })
      expect(within(relation).getByText('y = 10x + 20')).toBeInTheDocument()
    })

    it('calculates a column from the measurements and offers it as an axis', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)
      await user.click(screen.getByRole('radio', { name: /고급/ }))

      await user.type(screen.getByLabelText('새 열 이름', { selector: '#calculated-column-name' }), 'ln_temp')
      await user.type(screen.getByLabelText('식'), 'ln(temperature_c)')
      await user.click(screen.getAllByRole('button', { name: '열 만들기' })[1])

      const summary = screen.getByRole('region', { name: '2. 측정값 요약' })
      const row = within(summary).getByRole('row', { name: /^ln_temp/ })
      // ln(20), ln(22), ln(24)의 평균
      expect(within(row).getAllByRole('cell')[1]).toHaveTextContent('3.08828')
      expect(within(screen.getByLabelText('가로축(x) 변인')).getByRole('option', { name: 'ln_temp' })).toBeInTheDocument()
    })

    it('says why an expression could not be read instead of adding an empty column', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)
      await user.click(screen.getByRole('radio', { name: /고급/ }))

      await user.type(screen.getByLabelText('새 열 이름', { selector: '#calculated-column-name' }), '엉뚱')
      await user.type(screen.getByLabelText('식'), 'ln(없는열)')
      await user.click(screen.getAllByRole('button', { name: '열 만들기' })[1])

      expect(screen.getByRole('alert')).toHaveTextContent('읽을 수 없습니다')
      const summary = screen.getByRole('region', { name: '2. 측정값 요약' })
      expect(within(summary).queryByRole('row', { name: /^엉뚱/ })).not.toBeInTheDocument()
    })

    /** 속도는 이웃한 두 행의 차이라서, 그 행 하나만 봐서는 만들 수 없습니다. */
    it('makes a rate from the neighbouring rows', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, 'time_ms,distance_m{enter}0,0.10{enter}100,0.20{enter}200,0.30')
      await user.click(screen.getByRole('radio', { name: /고급/ }))

      await user.type(screen.getByLabelText('새 열 이름', { selector: '#calculated-column-name' }), '속도_mps')
      await user.type(screen.getByLabelText('식'), 'diff(distance_m)/diff(time_ms)*1000')
      await user.click(screen.getAllByRole('button', { name: '열 만들기' })[1])

      const summary = screen.getByRole('region', { name: '2. 측정값 요약' })
      const row = within(summary).getByRole('row', { name: /^속도_mps/ })
      // 첫 행은 앞이 없어 빈 칸이고, 남은 두 행은 모두 1 m/s입니다.
      expect(within(row).getAllByRole('cell')[0]).toHaveTextContent('2')
      expect(within(row).getAllByRole('cell')[1]).toHaveTextContent('1')
    })
  })

  /**
   * 기록 전체가 아니라 한 토막만 보는 탐구가 많습니다. 구간을 고를 수 없으면 낙하 전
   * 정지 구간까지 직선에 함께 끼어 기울기가 절반으로 줄어듭니다.
   */
  describe('구간 자르기', { timeout: 30_000 }, () => {
    it('keeps only the rows inside the range and says how many were left out', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)
      await user.click(screen.getByRole('radio', { name: /고급/ }))

      await user.selectOptions(screen.getByLabelText('기준 열'), 'time_ms')
      await user.type(screen.getByLabelText('이 값부터'), '1000')

      expect(screen.getByText(/2개 행이 남았고 1개 행을 뺐습니다/)).toBeInTheDocument()
      expect(screen.getByRole('img')).toHaveAccessibleName(/점은 모두 2개입니다/)
    })

    /** 자르기가 계산보다 먼저라서, 자른 뒤에 시간을 0부터 다시 셀 수 있습니다. */
    it('crops before it calculates so the clock can start again at zero', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)
      await user.click(screen.getByRole('radio', { name: /고급/ }))

      await user.selectOptions(screen.getByLabelText('기준 열'), 'time_ms')
      await user.type(screen.getByLabelText('이 값부터'), '1000')
      await user.type(screen.getByLabelText('새 열 이름', { selector: '#calculated-column-name' }), '경과_ms')
      await user.type(screen.getByLabelText('식'), 'time_ms - first(time_ms)')
      await user.click(screen.getAllByRole('button', { name: '열 만들기' })[1])

      const summary = screen.getByRole('region', { name: '2. 측정값 요약' })
      const row = within(summary).getByRole('row', { name: /^경과_ms/ })
      expect(within(row).getAllByRole('cell')[3]).toHaveTextContent('0')
      expect(within(row).getAllByRole('cell')[7]).toHaveTextContent('1,000')
    })
  })

  /**
   * 센서를 여러 개 단 레시피는 한 행씩 번갈아 출력하므로, 나누지 않으면 이웃한 점이
   * 서로 다른 센서가 되어 톱니만 남습니다.
   */
  describe('계열 나누기', { timeout: 30_000 }, () => {
    const CHANNELS = 'time_ms,channel,light_raw{enter}0,0,8200{enter}120,1,2400{enter}500,0,8180'
      + '{enter}620,1,2380{enter}1000,0,8210{enter}1120,1,2420'

    it('draws one series per sensor instead of one zigzag', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, CHANNELS)

      await user.click(screen.getByRole('checkbox', { name: /light_raw/ }))
      await user.click(screen.getByRole('checkbox', { name: /channel/ }))
      await user.selectOptions(screen.getByLabelText('계열 나누기 기준'), 'channel')

      expect(screen.getByRole('img')).toHaveAccessibleName(/계열은 channel 0, channel 1입니다/)
      const relation = screen.getByRole('region', { name: '4. 두 변인의 관계' })
      expect(within(relation).getByRole('row', { name: /^0/ })).toBeInTheDocument()
      expect(within(relation).getByRole('row', { name: /^1/ })).toBeInTheDocument()
    })

    it('does not offer a column whose value changes on every row', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, CHANNELS)

      const options = within(screen.getByLabelText('계열 나누기 기준')).getAllByRole('option')
      expect(options.map((option) => option.textContent)).toEqual(['나누지 않기', 'channel (2가지)'])
    })

    /** 같은 시각 두 지점의 차이는 값이 세로로 번갈아 쌓여 있는 한 만들 수 없습니다. */
    it('lays the sensors out in columns so one can be subtracted from the other', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, CHANNELS)
      await user.selectOptions(screen.getByLabelText('계열 나누기 기준'), 'channel')
      await user.click(screen.getByRole('radio', { name: /고급/ }))
      await user.click(screen.getByRole('checkbox', { name: /channel 값마다 열을 따로 만들기/ }))

      await user.type(screen.getByLabelText('새 열 이름', { selector: '#calculated-column-name' }), '밝기차')
      await user.type(screen.getByLabelText('식'), 'light_raw_0 - light_raw_1')
      await user.click(screen.getAllByRole('button', { name: '열 만들기' })[1])

      const summary = screen.getByRole('region', { name: '2. 측정값 요약' })
      const row = within(summary).getByRole('row', { name: /^밝기차/ })
      // (8200−2400), (8180−2380), (8210−2420)의 평균
      expect(within(row).getAllByRole('cell')[1]).toHaveTextContent('5,796.67')
    })
  })

  /**
   * 교실 격자의 조도 분포처럼 어디가 밝고 어두운지를 보는 탐구는 꺾은선이 아니라
   * 놓인 자리 그대로의 표로 읽어야 합니다.
   */
  describe('격자로 보기', { timeout: 30_000 }, () => {
    const FIELD = 'time_ms,ch0,ch1,ch2{enter}0,900,500,200{enter}500,910,490,210{enter}1000,890,510,190'

    it('lays the averages out in a grid once the advanced tools are on', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, FIELD)

      expect(screen.queryByRole('region', { name: /격자로 보기/ })).not.toBeInTheDocument()

      await user.click(screen.getByRole('radio', { name: /고급/ }))

      const grid = screen.getByRole('region', { name: '6. 격자로 보기' })
      const cells = within(grid).getAllByRole('cell')
      expect(cells).toHaveLength(3)
      expect(cells[0]).toHaveTextContent('ch0')
      expect(cells[0]).toHaveTextContent('900')
      expect(cells[2]).toHaveTextContent('200')
    })

    it('does not show a grid when there is nothing to lay out', async () => {
      const user = userEvent.setup()
      render(<DataAnalysisPage />)
      await paste(user, RUN_1)
      await user.click(screen.getByRole('radio', { name: /고급/ }))

      expect(screen.queryByRole('region', { name: /격자로 보기/ })).not.toBeInTheDocument()
    })
  })
})
