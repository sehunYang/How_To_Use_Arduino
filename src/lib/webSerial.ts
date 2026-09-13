import { MAX_SERIAL_INPUT_CHARS } from '@/lib/serialCsv'

/**
 * 아두이노가 USB로 보내는 글을 브라우저가 받는 길.
 *
 * 지금까지 학생은 IDE 시리얼 모니터에서 글을 끌어 복사해 붙여 넣었습니다.
 * 시리얼 모니터는 오래 켜 두면 앞부분이 잘리고, 끌어서 고르는 동안에도 값이
 * 계속 밀려 내려와 첫 줄(열 이름)을 놓치기 쉽습니다. 브라우저가 포트를 열면
 * 그 손이 없어집니다. 크롬·엣지에서만 되므로 붙여넣기는 그대로 둡니다.
 */

/** 레시피 스케치가 쓰는 속도 둘에, 학생이 코드를 고쳤을 때 고를 수 있는 흔한 값을 더한 목록. */
export const BAUD_RATES = [9600, 19200, 38400, 57600, 115200] as const
export const DEFAULT_BAUD_RATE = 9600
/** 우노가 낼 수 있는 가장 빠른 속도의 두 배. 그보다 큰 값은 오타입니다. */
const MAX_BAUD_RATE = 4_000_000

/**
 * 한 번에 들고 있을 양의 한계. 글자 수는 붙여넣기 파서의 한계보다 작게 두어
 * 받은 글이 파서에서 되돌아오지 않게 하고, 줄 수는 받기를 켜 둔 채 자리를 비워도
 * 브라우저가 멈추지 않게 합니다.
 */
export const MAX_CAPTURE_CHARS = MAX_SERIAL_INPUT_CHARS - 100_000
export const MAX_CAPTURE_LINES = 100_000

export type SerialLike = Pick<Serial, 'requestPort'>

export function findWebSerial(): SerialLike | null {
  if (typeof navigator === 'undefined') return null
  const serial = (navigator as Navigator & { serial?: SerialLike }).serial
  return serial && typeof serial.requestPort === 'function' ? serial : null
}

/**
 * 주소의 `?baud=` 값. 레시피의 속도는 스케치의 `Serial.begin`에서 오므로 목록에
 * 없는 값도 있을 수 있습니다. 양의 정수면 받습니다.
 */
export function parseBaudRate(raw: string | null | undefined): number | null {
  if (!raw) return null
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 && value <= MAX_BAUD_RATE ? value : null
}

/**
 * USB에서 오는 글자 덩어리는 줄 경계와 무관하게 끊깁니다. 덩어리를 줄로 자르고,
 * 마지막에 남은 조각은 스트림이 닫힐 때 내보냅니다.
 */
export function lineSplitter(): TransformStream<string, string> {
  let carry = ''
  return new TransformStream<string, string>({
    transform(chunk, controller) {
      carry += chunk
      const lines = carry.split(/\r\n|\r|\n/)
      carry = lines.pop() ?? ''
      for (const line of lines) controller.enqueue(line)
    },
    flush(controller) {
      if (carry.length > 0) controller.enqueue(carry)
    },
  })
}

/** 속도가 어긋나면 UTF-8로 읽히지 않는 바이트(U+FFFD)나 제어 문자가 섞여 나옵니다. */
export function isGarbledLine(line: string) {
  // eslint-disable-next-line no-control-regex
  return /[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(line)
}

/**
 * 받은 줄이 속도 불일치로 깨져 있는지. 리셋 직후 한두 줄은 정상일 때도 깨지므로
 * 몇 줄은 보고 나서, 절반 넘게 깨졌을 때만 그렇다고 답합니다.
 */
export function looksGarbled(lines: readonly string[], minimumLines = 3) {
  const meaningful = lines.filter((line) => line.trim().length > 0)
  if (meaningful.length < minimumLines) return false
  const garbled = meaningful.filter(isGarbledLine).length
  return garbled * 2 > meaningful.length
}

export type SerialErrorKind = 'cancelled' | 'busy' | 'lost' | 'unsupported' | 'baud' | 'unknown'

export interface SerialCaptureError {
  kind: SerialErrorKind
  message: string
}

const BUSY_MESSAGE =
  '포트를 열 수 없습니다. 아두이노 IDE의 시리얼 모니터가 열려 있으면 그 창을 닫고 다시 누르세요. 포트는 한 번에 한 프로그램만 씁니다.'
const LOST_MESSAGE = '보드와 연결이 끊겼습니다. 케이블을 확인한 뒤 다시 받으세요. 지금까지 받은 값은 남겨 두었습니다.'
const CLOSE_FAILED_MESSAGE = '포트를 닫지 못했습니다. 이 상태로는 IDE에서 업로드가 안 되니, 이 화면을 새로 고치세요.'

/** 브라우저가 던지는 예외를 학생이 다음에 할 일이 보이는 문장으로 바꿉니다. */
export function describeSerialError(error: unknown, phase: 'open' | 'read'): SerialCaptureError {
  // DOMException은 실행 환경(다른 프레임, 시험 환경)에 따라 Error를 상속하지 않을 수 있어 이름만 읽습니다.
  const named = typeof error === 'object' && error !== null ? (error as { name?: unknown }) : {}
  const name = typeof named.name === 'string' ? named.name : ''
  if (name === 'NotFoundError') {
    // 포트 선택 창에서 취소를 눌렀을 때. 오류가 아니므로 화면에는 아무것도 띄우지 않습니다.
    return { kind: 'cancelled', message: '' }
  }
  if (name === 'SecurityError') {
    return { kind: 'unsupported', message: '이 창에서는 USB 포트를 열 수 없습니다. 새 탭을 열어 주소를 다시 입력한 뒤 시도하세요.' }
  }
  if (name === 'InvalidStateError') {
    return { kind: 'busy', message: '포트가 이미 열려 있습니다. 이 화면을 새로 고친 뒤 다시 시도하세요.' }
  }
  if (name === 'NetworkError') {
    return phase === 'open' ? { kind: 'busy', message: BUSY_MESSAGE } : { kind: 'lost', message: LOST_MESSAGE }
  }
  if (name === 'BreakError' || name === 'FramingError' || name === 'ParityError' || name === 'BufferOverrunError') {
    return { kind: 'baud', message: '보드에서 온 신호가 깨졌습니다. 속도를 스케치의 Serial.begin 값과 같게 맞추고, 케이블이 헐겁지 않은지 확인하세요.' }
  }
  console.error('Web Serial 오류', error)
  return { kind: 'unknown', message: 'USB로 받는 중 오류가 났습니다. 케이블을 뺐다 꽂고 다시 시도하세요.' }
}

export interface SerialCaptureOptions {
  serial: SerialLike
  baudRate: number
  onLine: (line: string) => void
  /**
   * 받기가 끝났을 때 한 번. 사람이 멈췄고 포트도 닫혔으면 `null`, 끊겼거나 포트를
   * 못 닫았으면 그 이유입니다.
   */
  onEnd: (error: SerialCaptureError | null) => void
}

export interface SerialCaptureHandle {
  /** 읽기를 멈추고 포트를 닫습니다. 닫아 두지 않으면 IDE에서 업로드가 안 됩니다. */
  stop: () => Promise<void>
}

async function pulseReset(port: SerialPort) {
  // 우노는 DTR 선이 높음→낮음으로 바뀔 때 리셋됩니다. API의 `dataTerminalReady: true`가
  // 선을 낮음으로 두는 쪽이라, false→true 순서가 곧 높음→낮음입니다. 리셋을 걸어야
  // 스케치가 setup()부터 돌아 열 이름 줄을 먼저 보냅니다. 걸지 않으면 측정값 한가운데부터
  // 받게 되어 열 이름이 없다는 오류로 끝납니다. 신호를 못 바꾸는 포트는 건너뜁니다.
  try {
    await port.setSignals({ dataTerminalReady: false })
    await new Promise((resolve) => setTimeout(resolve, 50))
    await port.setSignals({ dataTerminalReady: true })
  } catch {
    // 리셋 없이 받되, 파서가 열 이름을 못 찾으면 그때 알려 줍니다.
  }
}

/**
 * 포트 선택 창을 띄우고, 고른 포트를 열어 줄 단위로 읽기 시작합니다.
 * 선택 취소·포트 사용 중 같은 열기 실패는 예외로 던지므로 부르는 쪽이 문장으로 바꿔 보여 줍니다.
 */
export async function startSerialCapture(options: SerialCaptureOptions): Promise<SerialCaptureHandle> {
  const { serial, baudRate, onLine, onEnd } = options
  const port = await serial.requestPort()
  await port.open({ baudRate })
  if (!port.readable) {
    await port.close().catch(() => undefined)
    throw new DOMException('Port has no readable stream', 'NetworkError')
  }
  await pulseReset(port)

  const decoder = new TextDecoderStream()
  const readableClosed = port.readable.pipeTo(decoder.writable)
  const reader = decoder.readable.pipeThrough(lineSplitter()).getReader()
  let stoppedByUser = false

  const finished = (async () => {
    let failure: SerialCaptureError | null = null
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        onLine(value)
      }
    } catch (error) {
      failure = describeSerialError(error, 'read')
    }
    // 읽기 줄기가 다 풀린 뒤에 닫아야 포트 잠금이 풀려 close()가 됩니다.
    await readableClosed.catch(() => undefined)
    let closeFailure: SerialCaptureError | null = null
    try {
      await port.close()
    } catch (error) {
      // 연결이 끊겨 닫을 것이 없을 때도 close()가 실패하므로, 그 경우는 끊김 쪽 이유를 앞세웁니다.
      if (!failure) closeFailure = { kind: 'busy', message: CLOSE_FAILED_MESSAGE }
      console.error('Web Serial 포트 닫기 실패', error)
    }
    if (stoppedByUser) onEnd(closeFailure)
    else onEnd(failure ?? closeFailure ?? { kind: 'lost', message: LOST_MESSAGE })
  })()

  return {
    async stop() {
      stoppedByUser = true
      await reader.cancel().catch(() => undefined)
      await finished
    },
  }
}
