// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SerialCapturePanel } from './SerialCapturePanel'

/** 줄을 흘려 넣을 수 있는 가짜 포트를 브라우저에 끼웁니다. */
function installSilentPort() {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null
  const encoder = new TextEncoder()
  const readable = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
    cancel() {
      controller = null
    },
  })
  const port = {
    readable,
    writable: null,
    open: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    setSignals: vi.fn(async () => undefined),
  }
  Object.defineProperty(navigator, 'serial', {
    configurable: true,
    value: { requestPort: vi.fn(async () => port) },
  })
  return { port, push: (text: string) => controller?.enqueue(encoder.encode(text)) }
}

describe('SerialCapturePanel: 기다려도 값이 오지 않을 때', () => {
  afterEach(() => {
    cleanup()
    Reflect.deleteProperty(navigator, 'serial')
  })

  async function startCapture(push: (text: string) => void, firstLines: string) {
    const user = userEvent.setup()
    render(
      <SerialCapturePanel baudRate={9600} onBaudRateChange={() => undefined} onCaptured={() => undefined} silenceTimeoutMs={80} settleMs={0} />,
    )
    await user.click(screen.getByRole('button', { name: '연결' }))
    await user.click(await screen.findByRole('button', { name: '측정 시작' }))
    await screen.findByRole('button', { name: '정지' })
    if (firstLines) push(firstLines)
  }

  it('아무 줄도 없으면 업로드와 속도를 보라고 알린다', async () => {
    const { push } = installSilentPort()
    await startCapture(push, '')

    expect(await screen.findByText(/아무 줄이 오지 않습니다/)).toBeInTheDocument()
  })

  it('열 이름 줄만 오고 값이 없으면 센서 준비에서 멈췄다고 알린다', async () => {
    const { push } = installSilentPort()
    await startCapture(push, 'time_ms,temperature_c\r\n')

    expect(await screen.findByText(/열 이름 줄만 오고/)).toBeInTheDocument()
  })

  it('보드가 오류 줄을 찍으면 그 줄을 보여 주고, 열 이름 줄로 오해하지 않는다', async () => {
    const { push } = installSilentPort()
    await startCapture(push, '# BME280_ERROR' + '\r\n' + 'time_ms,temperature_c' + '\r\n')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('보드가 오류를 알렸습니다')
    expect(alert).toHaveTextContent('# BME280_ERROR')
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(screen.queryByText(/열 이름 줄만/)).not.toBeInTheDocument()
  })

  it('값이 제때 오면 아무 말도 하지 않는다', async () => {
    const { push } = installSilentPort()
    await startCapture(push, 'time_ms,temperature_c\r\n0,21.5\r\n')

    await screen.findByText(/2줄 받는 중/)
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(screen.queryByText(/오지 않습니다|열 이름 줄만/)).not.toBeInTheDocument()
  })
})

describe('SerialCapturePanel: 연결과 측정을 따로 한다', () => {
  afterEach(() => {
    cleanup()
    Reflect.deleteProperty(navigator, 'serial')
  })

  async function connect(onCaptured: (text: string) => void = () => undefined) {
    const fake = installSilentPort()
    const user = userEvent.setup()
    render(<SerialCapturePanel baudRate={9600} onBaudRateChange={() => undefined} onCaptured={onCaptured} settleMs={0} />)
    await user.click(screen.getByRole('button', { name: '연결' }))
    await screen.findByRole('button', { name: '측정 시작' })
    return { ...fake, user }
  }

  async function startMeasuring(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: '측정 시작' }))
    await screen.findByRole('button', { name: '정지' })
  }

  it('연결만 해서는 리셋도 하지 않고 오는 줄도 모으지 않는다', async () => {
    const { port, push } = await connect()

    push('1000,20\r\n2000,21\r\n')
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(port.setSignals).not.toHaveBeenCalled()
    expect(screen.getByText(/연결했습니다/)).toBeInTheDocument()
    expect(screen.queryByText(/줄 받는 중/)).not.toBeInTheDocument()
  })

  it('측정 시작을 누르면 보드를 리셋하고 그때부터 받는다', async () => {
    const { port, push, user } = await connect()
    push('9000,30\r\n')
    await startMeasuring(user)

    expect(port.setSignals.mock.calls).toEqual([[{ dataTerminalReady: false }], [{ dataTerminalReady: true }]])
    push('time_ms,temperature_c\r\n0,20\r\n')
    expect(await screen.findByText(/2줄 받는 중/)).toBeInTheDocument()
  })

  it('일시 정지한 동안 온 줄은 버리고, 이어서 측정하면 뒤에 붙인다', async () => {
    const onCaptured = vi.fn()
    const { push, user } = await connect(onCaptured)
    await startMeasuring(user)
    push('time_ms,temperature_c\r\n0,20\r\n')
    await screen.findByText(/2줄 받는 중/)

    await user.click(screen.getByRole('button', { name: '일시 정지' }))
    expect(screen.getByText(/2줄에서 일시 정지했습니다/)).toBeInTheDocument()
    push('1000,21\r\n')
    await new Promise((resolve) => setTimeout(resolve, 30))

    await user.click(screen.getByRole('button', { name: '이어서 측정' }))
    push('2000,22\r\n')
    await screen.findByText(/3줄 받는 중/)

    await user.click(screen.getByRole('button', { name: '정지' }))
    expect(screen.getByText(/3줄을 받았습니다. 회차로 추가할지 고르세요/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '회차로 추가' }))

    expect(onCaptured).toHaveBeenCalledWith('time_ms,temperature_c\n0,20\n2000,22')
    // 포트는 그대로 열려 있어 다음 회차를 바로 잴 수 있습니다.
    expect(screen.getByRole('button', { name: '측정 시작' })).toBeInTheDocument()
  })

  it('일시 정지에서 처음부터 다시를 고르면 받은 줄을 비우고 보드를 다시 리셋한다', async () => {
    const onCaptured = vi.fn()
    const { port, push, user } = await connect(onCaptured)
    await startMeasuring(user)
    push('time_ms,temperature_c\r\n0,20\r\n1000,21\r\n')
    await screen.findByText(/3줄 받는 중/)
    await user.click(screen.getByRole('button', { name: '일시 정지' }))

    await user.click(screen.getByRole('button', { name: '처음부터 다시' }))
    await screen.findByRole('button', { name: '정지' })
    expect(port.setSignals).toHaveBeenCalledTimes(4)
    push('time_ms,temperature_c\r\n0,25\r\n')
    await screen.findByText(/2줄 받는 중/)

    await user.click(screen.getByRole('button', { name: '정지' }))
    await user.click(screen.getByRole('button', { name: '회차로 추가' }))
    expect(onCaptured).toHaveBeenCalledWith('time_ms,temperature_c\n0,25')
  })

  it('정지 뒤 버리기를 고르면 회차로 넣지 않는다', async () => {
    const onCaptured = vi.fn()
    const { push, user } = await connect(onCaptured)
    await startMeasuring(user)
    push('time_ms,temperature_c\r\n0,20\r\n')
    await screen.findByText(/2줄 받는 중/)

    await user.click(screen.getByRole('button', { name: '정지' }))
    await user.click(screen.getByRole('button', { name: '버리기' }))

    expect(onCaptured).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '측정 시작' })).toBeInTheDocument()
  })

  it('연결 끊기를 누르면 포트를 닫고 다시 연결할 수 있게 한다', async () => {
    const { port, user } = await connect()

    await user.click(screen.getByRole('button', { name: '연결 끊기' }))

    expect(port.close).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('button', { name: '연결' })).toBeEnabled()
  })
})
