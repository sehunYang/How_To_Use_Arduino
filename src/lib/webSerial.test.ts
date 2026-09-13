import { describe, expect, it, vi } from 'vitest'
import {
  describeSerialError,
  isGarbledLine,
  lineSplitter,
  looksGarbled,
  parseBaudRate,
  startSerialCapture,
  type SerialLike,
} from './webSerial'

async function splitAll(chunks: string[]) {
  const splitter = lineSplitter()
  const writer = splitter.writable.getWriter()
  const lines: string[] = []
  const reading = (async () => {
    const reader = splitter.readable.getReader()
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      lines.push(value)
    }
  })()
  for (const chunk of chunks) await writer.write(chunk)
  await writer.close()
  await reading
  return lines
}

describe('lineSplitter', () => {
  it('덩어리 경계와 줄 경계가 어긋나도 줄을 온전히 잇는다', async () => {
    expect(await splitAll(['time_ms,tem', 'p\r\n0,2', '1.5\r\n1000', ',21.7\r\n'])).toEqual([
      'time_ms,temp',
      '0,21.5',
      '1000,21.7',
    ])
  })

  it('줄바꿈 없이 끝난 조각은 닫힐 때 내보낸다', async () => {
    expect(await splitAll(['a\nb'])).toEqual(['a', 'b'])
    expect(await splitAll(['a\r', 'b'])).toEqual(['a', 'b'])
  })
})

describe('looksGarbled', () => {
  it('속도가 어긋나 깨진 글자가 절반을 넘을 때만 그렇다고 답한다', () => {
    expect(isGarbledLine('0,21.5')).toBe(false)
    expect(isGarbledLine('\uFFFD\uFFFDx')).toBe(true)
    expect(looksGarbled(['\uFFFD', '\uFFFD'])).toBe(false)
    expect(looksGarbled(['\uFFFD\u0001', '\uFFFD', 'ok'])).toBe(true)
    expect(looksGarbled(['\uFFFD', 'time_ms,t', '0,1', '1,2'])).toBe(false)
  })
})

describe('parseBaudRate', () => {
  it('레시피가 넘긴 속도는 목록에 없어도 양의 정수면 받는다', () => {
    expect(parseBaudRate('115200')).toBe(115200)
    expect(parseBaudRate('250000')).toBe(250000)
    expect(parseBaudRate('0')).toBeNull()
    expect(parseBaudRate('-9600')).toBeNull()
    expect(parseBaudRate('9600.5')).toBeNull()
    expect(parseBaudRate('fast')).toBeNull()
    expect(parseBaudRate(null)).toBeNull()
  })
})

describe('describeSerialError', () => {
  it('열 때의 NetworkError는 포트 사용 중, 읽는 중의 NetworkError는 연결 끊김으로 읽는다', () => {
    const error = new DOMException('Failed to open serial port.', 'NetworkError')
    expect(describeSerialError(error, 'open')).toMatchObject({ kind: 'busy' })
    expect(describeSerialError(error, 'open').message).toContain('시리얼 모니터')
    expect(describeSerialError(error, 'read')).toMatchObject({ kind: 'lost' })
  })

  it('선택 창 취소는 오류 문장 없이 넘긴다', () => {
    expect(describeSerialError(new DOMException('No port selected', 'NotFoundError'), 'open')).toEqual({
      kind: 'cancelled',
      message: '',
    })
  })
})

interface FakePortOptions {
  chunks?: Uint8Array[]
  /** 읽는 중에 던질 예외. 케이블이 뽑힌 상황입니다. */
  readError?: Error
}

function fakePort({ chunks = [], readError }: FakePortOptions = {}) {
  let release: (() => void) | null = null
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      if (readError) {
        controller.error(readError)
        return
      }
      await new Promise<void>((resolve) => {
        release = resolve
      })
      controller.close()
    },
    cancel() {
      release?.()
    },
  })
  const port = {
    readable,
    writable: null,
    open: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    setSignals: vi.fn(async () => undefined),
  }
  return port as unknown as SerialPort & typeof port
}

function serialFor(port: SerialPort): SerialLike {
  return { requestPort: vi.fn(async () => port) }
}

describe('startSerialCapture', () => {
  it('보드를 리셋해 열 이름부터 받고, 멈추면 포트를 닫는다', async () => {
    const encoder = new TextEncoder()
    const port = fakePort({ chunks: [encoder.encode('time_ms,temp\r\n0,2'), encoder.encode('1.5\r\n')] })
    const lines: string[] = []
    const onEnd = vi.fn()

    const capture = await startSerialCapture({ serial: serialFor(port), baudRate: 9600, onLine: (line) => lines.push(line), onEnd })
    await vi.waitFor(() => expect(lines).toEqual(['time_ms,temp', '0,21.5']))

    expect(port.open).toHaveBeenCalledWith({ baudRate: 9600 })
    expect(port.setSignals.mock.calls).toEqual([[{ dataTerminalReady: false }], [{ dataTerminalReady: true }]])

    await capture.stop()
    expect(port.close).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith(null)
  })

  it('읽는 중에 연결이 끊기면 그 이유와 함께 끝났다고 알린다', async () => {
    const port = fakePort({ readError: new DOMException('The device has been lost.', 'NetworkError') })
    const onEnd = vi.fn()

    await startSerialCapture({ serial: serialFor(port), baudRate: 9600, onLine: () => undefined, onEnd })
    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1))

    expect(onEnd.mock.calls[0][0]).toMatchObject({ kind: 'lost' })
    expect(port.close).toHaveBeenCalledTimes(1)
  })

  it('포트를 열지 못하면 예외를 그대로 던져 부르는 쪽이 문장으로 바꾸게 한다', async () => {
    const port = fakePort()
    port.open.mockRejectedValueOnce(new DOMException('Failed to open serial port.', 'NetworkError'))

    await expect(
      startSerialCapture({ serial: serialFor(port), baudRate: 9600, onLine: () => undefined, onEnd: () => undefined }),
    ).rejects.toMatchObject({ name: 'NetworkError' })
    expect(port.close).not.toHaveBeenCalled()
  })
})
