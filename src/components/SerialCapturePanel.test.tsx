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
  return { push: (text: string) => controller?.enqueue(encoder.encode(text)) }
}

describe('SerialCapturePanel: 기다려도 값이 오지 않을 때', () => {
  afterEach(() => {
    cleanup()
    Reflect.deleteProperty(navigator, 'serial')
  })

  async function startCapture(push: (text: string) => void, firstLines: string) {
    const user = userEvent.setup()
    render(
      <SerialCapturePanel baudRate={9600} onBaudRateChange={() => undefined} onCaptured={() => undefined} silenceTimeoutMs={80} />,
    )
    await user.click(screen.getByRole('button', { name: 'USB로 받기' }))
    await screen.findByRole('button', { name: '멈추고 회차로 넣기' })
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
