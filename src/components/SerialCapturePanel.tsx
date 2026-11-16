import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  EMPTY_LIVE_CHECK,
  LIVE_CHECK_WINDOW,
  checkReceivedLines,
  describeSilence,
  type LiveCheckResult,
  type RecipeHint,
} from '@/lib/serialLiveCheck'
import {
  BAUD_RATES,
  MAX_CAPTURE_CHARS,
  MAX_CAPTURE_LINES,
  describeSerialError,
  findWebSerial,
  looksGarbled,
  connectSerial,
  type SerialCaptureError,
  type SerialConnection,
} from '@/lib/webSerial'

const PREVIEW_LINES = 5
/**
 * 리셋 뒤 부트로더가 2초쯤 기다리고, 센서 준비에 몇 초가 더 갑니다. 이만큼 지나도
 * 줄이 없거나 열 이름 줄뿐이면 기다림이 아니라 멈춤입니다.
 */
export const SILENCE_TIMEOUT_MS = 10_000

/** 포트가 열렸는지. 연결은 측정과 따로 갑니다. */
type Connection = 'idle' | 'opening' | 'connected'
/**
 * 측정이 어디까지 왔는지.
 * - ready: 받은 줄이 없고 측정을 시작할 수 있음
 * - restarting: 보드를 리셋하는 중
 * - measuring: 오는 줄을 모으는 중
 * - paused: 잠시 멈춤. 이어서 잴지 처음부터 다시 잴지 고름
 * - stopped: 끝남. 받은 줄을 회차로 넣을지 고름
 */
type Measure = 'ready' | 'restarting' | 'measuring' | 'paused' | 'stopped'

interface SerialCapturePanelProps {
  baudRate: number
  onBaudRateChange: (baudRate: number) => void
  /** [회차로 추가]를 누르면 받은 글 전체를 한 덩어리로 넘깁니다. 붙여넣은 글과 같은 길로 들어갑니다. */
  onCaptured: (text: string) => void
  /** 레시피 화면에서 왔을 때 받은 값을 견줄 기준. 없으면 열 이름·고장값 점검은 하지 않습니다. */
  hint?: RecipeHint | null
  /** 시험에서 10초를 기다리지 않으려고 줄이는 용도. */
  silenceTimeoutMs?: number
  /** 리셋 뒤 옛 글을 버리는 시간. 시험에서 줄이는 용도. */
  settleMs?: number
}

/**
 * 아두이노에서 USB로 받는 칸.
 *
 * [연결]은 포트만 엽니다. [측정 시작]을 눌러야 보드를 리셋하고 그때부터 오는 줄을 모읍니다.
 * 측정 중에는 [일시 정지]와 [정지]가 있고, 일시 정지하면 이어서 잴지 처음부터 다시 잴지,
 * 정지하면 받은 값을 회차로 넣을지 고릅니다. 받는 동안은 줄 수와 마지막 몇 줄만 보여 줍니다.
 */
export function SerialCapturePanel({
  baudRate,
  onBaudRateChange,
  onCaptured,
  hint = null,
  silenceTimeoutMs = SILENCE_TIMEOUT_MS,
  settleMs,
}: SerialCapturePanelProps) {
  const [serial] = useState(findWebSerial)
  const [connection, setConnection] = useState<Connection>('idle')
  const [measure, setMeasureState] = useState<Measure>('ready')
  const [lineCount, setLineCount] = useState(0)
  const [preview, setPreview] = useState<string[]>([])
  const [garbled, setGarbled] = useState(false)
  const [liveCheck, setLiveCheck] = useState<LiveCheckResult>(EMPTY_LIVE_CHECK)
  const [error, setError] = useState<SerialCaptureError | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const linesRef = useRef<string[]>([])
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const charCountRef = useRef(0)
  /** 측정 상태를 줄 받는 콜백에서도 바로 읽으려고 함께 둡니다. 측정 중일 때만 줄을 모읍니다. */
  const measureRef = useRef<Measure>('ready')
  /** 포트가 열리기도 전에 끝나 버렸을 때(꽂자마자 뽑힘) 손잡이를 뒤늦게 붙들지 않게 합니다. */
  const endedRef = useRef(false)
  const connectionRef = useRef<SerialConnection | null>(null)
  /** 화면을 떠난 뒤 포트가 열리면 곧바로 닫습니다. 열어 둔 채 떠나면 IDE에서 업로드가 안 됩니다. */
  const aliveRef = useRef(true)
  /**
   * 받는 동안 학생이 회차를 붙여넣거나 지울 수 있습니다. 연결할 때의 함수를 붙들고
   * 있으면 그 사이 바뀐 회차 목록을 모른 채 덮어써 회차가 사라집니다. 늘 최신 것을 부릅니다.
   */
  const onCapturedRef = useRef(onCaptured)
  onCapturedRef.current = onCaptured
  const hintRef = useRef(hint)
  hintRef.current = hint

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      clearSilenceTimer()
      void connectionRef.current?.stop()
    }
  }, [])

  function setMeasure(next: Measure) {
    measureRef.current = next
    setMeasureState(next)
  }

  function clearSilenceTimer() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = null
  }

  /** 기다릴 만큼 기다렸는데 값이 오지 않을 때, 무엇을 볼지 알려 줍니다. */
  function checkSilence() {
    silenceTimerRef.current = null
    if (!aliveRef.current || measureRef.current !== 'measuring') return
    const seconds = Math.max(1, Math.round(silenceTimeoutMs / 1000))
    switch (describeSilence(linesRef.current)) {
      case 'nothing':
        setNotice(`${seconds}초가 지나도 아무 줄이 오지 않습니다. IDE에서 업로드가 끝났는지, 속도가 코드의 Serial.begin 값과 같은지 확인하세요.`)
        break
      case 'headerOnly':
        setNotice('열 이름 줄만 오고 값이 따라오지 않습니다. 센서를 준비하는 단계에서 멈춘 것입니다. 전원과 통신 선(A4·A5 또는 데이터 핀)을 확인하세요.')
        break
      case 'deviceError':
        // 보드가 찍은 오류 줄은 이미 위에 빨간 상자로 떠 있습니다.
        break
      default:
        break
    }
  }

  if (!serial) {
    return (
      <p className="text-caption text-muted">
        크롬이나 엣지에서 이 화면을 열면 아두이노에서 USB로 받을 수 있습니다.
      </p>
    )
  }

  function clearReceived() {
    linesRef.current = []
    charCountRef.current = 0
    setLineCount(0)
    setPreview([])
    setGarbled(false)
    setLiveCheck(EMPTY_LIVE_CHECK)
  }

  function receive(line: string) {
    if (measureRef.current !== 'measuring') return
    const lines = linesRef.current
    lines.push(line)
    charCountRef.current += line.length + 1
    setLineCount(lines.length)
    setPreview(lines.slice(-PREVIEW_LINES))
    if (lines.length <= LIVE_CHECK_WINDOW) {
      setGarbled(looksGarbled(lines))
      setLiveCheck(checkReceivedLines(hintRef.current, lines))
    }
    if (lines.length >= MAX_CAPTURE_LINES || charCountRef.current >= MAX_CAPTURE_CHARS) {
      clearSilenceTimer()
      setMeasure('stopped')
      setNotice('한 번에 받을 수 있는 양이 차서 측정을 멈췄습니다. 받은 값을 회차로 넣을지 고르세요.')
    }
  }

  function finish(reason: SerialCaptureError | null) {
    endedRef.current = true
    connectionRef.current = null
    clearSilenceTimer()
    if (!aliveRef.current) return
    setConnection('idle')
    if (reason) setError(reason)
    const current = measureRef.current
    if (current === 'measuring' || current === 'paused' || current === 'restarting') {
      // 받던 값은 버리지 않고, 회차로 넣을지 고르게 합니다.
      setMeasure(linesRef.current.length > 0 ? 'stopped' : 'ready')
    }
  }

  async function connect() {
    if (!serial) return
    setError(null)
    setNotice(null)
    endedRef.current = false
    setConnection('opening')
    try {
      const opened = await connectSerial({ serial, baudRate, onLine: receive, onEnd: finish, settleMs })
      if (endedRef.current) return
      if (!aliveRef.current) {
        void opened.stop()
        return
      }
      connectionRef.current = opened
      setConnection('connected')
    } catch (caught) {
      if (!aliveRef.current) return
      const described = describeSerialError(caught, 'open')
      if (described.kind !== 'cancelled') setError(described)
      setConnection('idle')
    }
  }

  async function disconnect() {
    await connectionRef.current?.stop()
  }

  /** 받은 줄을 비우고, 보드를 리셋해 setup()부터 다시 받습니다. */
  async function startMeasuring() {
    const opened = connectionRef.current
    if (!opened) return
    clearSilenceTimer()
    clearReceived()
    setError(null)
    setNotice(null)
    setMeasure('restarting')
    await opened.restart()
    if (!aliveRef.current || connectionRef.current !== opened || measureRef.current !== 'restarting') return
    setMeasure('measuring')
    silenceTimerRef.current = setTimeout(checkSilence, silenceTimeoutMs)
  }

  function pause() {
    clearSilenceTimer()
    setMeasure('paused')
  }

  function resume() {
    setNotice(null)
    setMeasure('measuring')
  }

  function stopMeasuring() {
    clearSilenceTimer()
    setMeasure('stopped')
  }

  function keep() {
    const text = linesRef.current.join('\n')
    clearReceived()
    setMeasure('ready')
    if (text.trim().length > 0) {
      setNotice(null)
      onCapturedRef.current(text)
    } else {
      setNotice('받은 줄이 없어 회차로 넣지 않았습니다. 보드가 값을 보내는지 IDE 시리얼 모니터로 확인해 보세요.')
    }
  }

  function discard() {
    clearReceived()
    setNotice(null)
    setMeasure('ready')
  }

  const otherBaudRate = baudRate === 9600 ? 115200 : 9600
  // 레시피가 목록 밖의 속도를 넘겨 줘도 고를 수 있어야 하므로 목록에 끼워 넣습니다.
  const baudOptions = [...new Set<number>([...BAUD_RATES, baudRate])].sort((a, b) => a - b)

  const showReceived = measure === 'measuring' || measure === 'paused' || measure === 'stopped'
  const count = lineCount.toLocaleString('ko-KR')
  let status: string
  switch (measure) {
    case 'restarting':
      status = '보드를 다시 켜는 중…'
      break
    case 'measuring':
      status = `${count}줄 받는 중… 원하는 만큼 모이면 [정지]를 누르세요.`
      break
    case 'paused':
      status = `${count}줄에서 일시 정지했습니다. 이어서 잴지, 처음부터 다시 잴지 고르세요.`
      break
    case 'stopped':
      status = `${count}줄을 받았습니다. 회차로 추가할지 고르세요.`
      break
    default:
      status = connection === 'connected' ? '연결했습니다. [측정 시작]을 누르면 보드를 다시 켜고 처음부터 받습니다.' : ''
  }

  return (
    <div className="rounded-card border border-border p-4">
      <h3 className="font-semibold">USB로 바로 받기</h3>
      <p className="mt-1 text-caption text-muted">
        아두이노를 꽂은 채 [연결]을 누르세요. IDE의 시리얼 모니터 창은 닫아야 합니다. 연결만으로는 값을 모으지 않고, [측정 시작]을 누르면 보드가 처음부터 다시 돌며 그때부터 받습니다.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="serial-baud" className="text-caption font-semibold">속도(baud)</label>
          <select
            id="serial-baud"
            value={baudRate}
            disabled={connection !== 'idle'}
            onChange={(event) => onBaudRateChange(Number(event.target.value))}
            className="mt-1 block rounded-card border border-border bg-background p-2 text-body focus:border-accent"
          >
            {baudOptions.map((rate) => (
              <option key={rate} value={rate}>{rate}</option>
            ))}
          </select>
        </div>
        {connection === 'connected' ? (
          <>
            {(measure === 'ready' || measure === 'restarting') && (
              <Button size="lg" onClick={startMeasuring} disabled={measure === 'restarting'}>측정 시작</Button>
            )}
            {measure === 'measuring' && (
              <>
                <Button size="lg" variant="outline" onClick={pause}>일시 정지</Button>
                <Button size="lg" onClick={stopMeasuring}>정지</Button>
              </>
            )}
            {measure === 'paused' && (
              <>
                <Button size="lg" onClick={resume}>이어서 측정</Button>
                <Button size="lg" variant="outline" onClick={startMeasuring}>처음부터 다시</Button>
                <Button size="lg" variant="outline" onClick={stopMeasuring}>정지</Button>
              </>
            )}
            {measure !== 'stopped' && (
              <Button size="lg" variant="ghost" onClick={disconnect}>연결 끊기</Button>
            )}
          </>
        ) : (
          measure !== 'stopped' && (
            <Button size="lg" onClick={connect} disabled={connection === 'opening'}>
              {connection === 'opening' ? '포트 여는 중…' : '연결'}
            </Button>
          )
        )}
        {measure === 'stopped' && (
          <>
            <Button size="lg" onClick={keep}>회차로 추가</Button>
            <Button size="lg" variant="outline" onClick={discard}>버리기</Button>
          </>
        )}
      </div>

      {status && (
        <p aria-live="polite" className="mt-4 text-caption">{status}</p>
      )}

      {showReceived && (
        <div className="mt-2">
          <pre className="max-h-40 overflow-x-auto whitespace-pre rounded-card border border-border bg-muted-background p-3 font-mono text-caption" aria-label="마지막으로 받은 줄">
            {preview.length > 0 ? preview.join('\n') : '아직 받은 줄이 없습니다. 보드가 다시 켜지는 데 몇 초가 걸립니다.'}
          </pre>
          {garbled && (
            <p role="alert" className="mt-2 rounded-card border border-warning bg-warning-background p-3 text-caption text-warning">
              받은 글자가 깨져 있습니다. 속도가 스케치와 다를 때 이렇게 나옵니다. [정지]와 [버리기]를 누르고 [연결 끊기]를 한 뒤, 속도를 {otherBaudRate}으로 바꿔 다시 받으세요.
            </p>
          )}
          {!garbled && liveCheck.deviceErrors.length > 0 && (
            <div role="alert" className="mt-2 rounded-card border border-danger bg-danger-background p-3 text-caption text-danger">
              <p className="font-semibold">보드가 오류를 알렸습니다. 센서를 준비하지 못한 것입니다. 전원과 통신 선(A4·A5 또는 데이터 핀)을 확인하세요.</p>
              <pre className="mt-1 whitespace-pre-wrap font-mono">{liveCheck.deviceErrors.join('\n')}</pre>
            </div>
          )}
          {!garbled && liveCheck.headerMismatch && (
            <p role="alert" className="mt-2 rounded-card border border-warning bg-warning-background p-3 text-caption text-warning">
              {liveCheck.headerMismatch}
            </p>
          )}
          {!garbled && liveCheck.signals.length > 0 && (
            <aside role="alert" aria-labelledby="live-reading-title" className="mt-2 rounded-card border border-warning bg-warning-background p-3 text-caption text-warning">
              <h4 id="live-reading-title" className="font-semibold">고장났을 때만 나오는 값이 보입니다</h4>
              <ul className="mt-1 list-disc pl-5">
                {liveCheck.signals.map((signal) => (
                  <li key={signal.sign}>
                    <span className="font-medium">{signal.sign}.</span> {signal.meaning}
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      )}

      {notice && (
        <p aria-live="polite" className="mt-3 text-caption text-muted">{notice}</p>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-card border border-danger bg-danger-background p-3 text-caption text-danger">
          {error.message}
        </p>
      )}
    </div>
  )
}
