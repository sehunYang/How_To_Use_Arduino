import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  BAUD_RATES,
  MAX_CAPTURE_CHARS,
  MAX_CAPTURE_LINES,
  describeSerialError,
  findWebSerial,
  looksGarbled,
  startSerialCapture,
  type SerialCaptureError,
  type SerialCaptureHandle,
} from '@/lib/webSerial'

const PREVIEW_LINES = 5
/** 속도 불일치는 처음 몇 줄만 보면 압니다. 뒤 줄까지 매번 훑으면 화면이 느려집니다. */
const GARBLE_CHECK_LINES = 20

type Phase = 'idle' | 'opening' | 'capturing'

interface SerialCapturePanelProps {
  baudRate: number
  onBaudRateChange: (baudRate: number) => void
  /** 받기를 멈추면 받은 글 전체를 한 덩어리로 넘깁니다. 붙여넣은 글과 같은 길로 들어갑니다. */
  onCaptured: (text: string) => void
}

/**
 * 아두이노에서 USB로 받는 칸.
 *
 * 받는 동안은 줄 수와 마지막 몇 줄만 보여 줍니다. 값이 오고 있다는 것과 속도가
 * 맞았다는 것만 알면 되고, 표와 그래프는 멈춘 뒤 아래에서 봅니다.
 */
export function SerialCapturePanel({ baudRate, onBaudRateChange, onCaptured }: SerialCapturePanelProps) {
  const [serial] = useState(findWebSerial)
  const [phase, setPhase] = useState<Phase>('idle')
  const [lineCount, setLineCount] = useState(0)
  const [preview, setPreview] = useState<string[]>([])
  const [garbled, setGarbled] = useState(false)
  const [error, setError] = useState<SerialCaptureError | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const linesRef = useRef<string[]>([])
  const charCountRef = useRef(0)
  /** [버리기]를 누른 뒤 포트가 닫히기 전에 도착한 줄까지 회차로 넘어가지 않게 합니다. */
  const discardedRef = useRef(false)
  /** 한계에 닿아 멈추는 중이면 뒤따라 오는 줄은 받지 않습니다. */
  const limitRef = useRef(false)
  /** 포트가 열리기도 전에 끝나 버렸을 때(꽂자마자 뽑힘) 손잡이를 뒤늦게 붙들지 않게 합니다. */
  const endedRef = useRef(false)
  const handleRef = useRef<SerialCaptureHandle | null>(null)
  /** 화면을 떠난 뒤 포트가 열리면 곧바로 닫습니다. 열어 둔 채 떠나면 IDE에서 업로드가 안 됩니다. */
  const aliveRef = useRef(true)
  /**
   * 받는 동안 학생이 회차를 붙여넣거나 지울 수 있습니다. 받기를 시작할 때의 함수를 붙들고
   * 있으면 그 사이 바뀐 회차 목록을 모른 채 덮어써 회차가 사라집니다. 늘 최신 것을 부릅니다.
   */
  const onCapturedRef = useRef(onCaptured)
  onCapturedRef.current = onCaptured

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      void handleRef.current?.stop()
    }
  }, [])

  if (!serial) {
    return (
      <p className="text-caption text-muted">
        크롬이나 엣지에서 이 화면을 열면 아두이노에서 USB로 받을 수 있습니다.
      </p>
    )
  }

  function finish(reason: SerialCaptureError | null) {
    endedRef.current = true
    handleRef.current = null
    if (!aliveRef.current) return
    setPhase('idle')
    if (reason && !discardedRef.current) setError(reason)
    if (discardedRef.current) return
    const text = linesRef.current.join('\n')
    if (text.trim().length > 0) onCapturedRef.current(text)
    else setNotice('받은 줄이 없어 회차로 넣지 않았습니다. 보드가 값을 보내는지 IDE 시리얼 모니터로 확인해 보세요.')
  }

  async function start() {
    if (!serial) return
    setError(null)
    setNotice(null)
    setGarbled(false)
    setLineCount(0)
    setPreview([])
    linesRef.current = []
    charCountRef.current = 0
    discardedRef.current = false
    limitRef.current = false
    endedRef.current = false
    setPhase('opening')
    try {
      const handle = await startSerialCapture({
        serial,
        baudRate,
        onLine(line) {
          if (limitRef.current) return
          const lines = linesRef.current
          lines.push(line)
          charCountRef.current += line.length + 1
          setLineCount(lines.length)
          setPreview(lines.slice(-PREVIEW_LINES))
          if (lines.length <= GARBLE_CHECK_LINES) setGarbled(looksGarbled(lines))
          if (lines.length >= MAX_CAPTURE_LINES || charCountRef.current >= MAX_CAPTURE_CHARS) {
            limitRef.current = true
            setNotice('한 번에 받을 수 있는 양이 차서 받기를 멈췄습니다. 지금까지 받은 값은 회차로 넣습니다.')
            void handleRef.current?.stop()
          }
        },
        onEnd: finish,
      })
      if (endedRef.current) return
      if (!aliveRef.current) {
        void handle.stop()
        return
      }
      handleRef.current = handle
      setPhase('capturing')
      // 한계는 손잡이가 오기 전에도 닿을 수 있습니다. 그때는 손잡이가 오자마자 멈춥니다.
      if (limitRef.current) void handle.stop()
    } catch (caught) {
      if (!aliveRef.current) return
      const described = describeSerialError(caught, 'open')
      if (described.kind !== 'cancelled') setError(described)
      setPhase('idle')
    }
  }

  async function stop() {
    await handleRef.current?.stop()
  }

  async function discard() {
    discardedRef.current = true
    await handleRef.current?.stop()
  }

  const otherBaudRate = baudRate === 9600 ? 115200 : 9600
  // 레시피가 목록 밖의 속도를 넘겨 줘도 고를 수 있어야 하므로 목록에 끼워 넣습니다.
  const baudOptions = [...new Set<number>([...BAUD_RATES, baudRate])].sort((a, b) => a - b)

  return (
    <div className="rounded-card border border-border p-4">
      <h3 className="font-semibold">USB로 바로 받기</h3>
      <p className="mt-1 text-caption text-muted">
        아두이노를 꽂은 채 누르세요. IDE의 시리얼 모니터 창은 닫아야 합니다. 받기를 시작하면 보드가 처음부터 다시 돕니다.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="serial-baud" className="text-caption font-semibold">속도(baud)</label>
          <select
            id="serial-baud"
            value={baudRate}
            disabled={phase !== 'idle'}
            onChange={(event) => onBaudRateChange(Number(event.target.value))}
            className="mt-1 block rounded-card border border-border bg-background p-2 text-body focus:border-accent"
          >
            {baudOptions.map((rate) => (
              <option key={rate} value={rate}>{rate}</option>
            ))}
          </select>
        </div>
        {phase === 'capturing' ? (
          <>
            <Button size="lg" onClick={stop}>멈추고 회차로 넣기</Button>
            <Button size="lg" variant="outline" onClick={discard}>버리기</Button>
          </>
        ) : (
          <Button size="lg" onClick={start} disabled={phase === 'opening'}>
            {phase === 'opening' ? '포트 여는 중…' : 'USB로 받기'}
          </Button>
        )}
      </div>

      {phase === 'capturing' && (
        <div className="mt-4">
          <p aria-live="polite" className="text-caption">
            {lineCount.toLocaleString('ko-KR')}줄 받는 중… 원하는 만큼 모이면 [멈추고 회차로 넣기]를 누르세요.
          </p>
          <pre className="mt-2 max-h-40 overflow-x-auto whitespace-pre rounded-card border border-border bg-muted-background p-3 font-mono text-caption" aria-label="마지막으로 받은 줄">
            {preview.length > 0 ? preview.join('\n') : '아직 받은 줄이 없습니다. 보드가 다시 켜지는 데 몇 초가 걸립니다.'}
          </pre>
          {garbled && (
            <p role="alert" className="mt-2 rounded-card border border-warning bg-warning-background p-3 text-caption text-warning">
              받은 글자가 깨져 있습니다. 속도가 스케치와 다를 때 이렇게 나옵니다. [버리기]를 누른 뒤 속도를 {otherBaudRate}으로 바꿔 다시 받으세요.
            </p>
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
