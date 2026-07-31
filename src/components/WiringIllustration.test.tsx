// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pendulumRecipe } from '@/data/canary'
import { phase5Recipes } from '@/data/phase5'
import { WiringIllustration } from './WiringIllustration'

beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn()
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    toJSON: () => ({}),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('WiringIllustration zoom and pan', () => {
  it('zooms with the mouse wheel and caps the vector diagram at 500%', () => {
    render(<WiringIllustration recipe={pendulumRecipe} activeStep={0} />)
    const viewport = screen.getByTestId('wiring-viewport')

    const wheel = new WheelEvent('wheel', {
      deltaY: -2000,
      clientX: 400,
      clientY: 300,
      bubbles: true,
      cancelable: true,
    })
    expect(fireEvent(viewport, wheel)).toBe(false)
    expect(wheel.defaultPrevented).toBe(true)
    expect(screen.getByRole('button', { name: '배선도 원래 크기' })).toHaveTextContent('500%')
    expect(screen.getByTestId('wiring-canvas')).toHaveStyle({
      transform: 'translate(0px, 0px) scale(5)',
    })
  })

  it('keeps the instructions and controls anchored inside the viewport', () => {
    render(<WiringIllustration recipe={pendulumRecipe} activeStep={0} />)
    const viewport = screen.getByTestId('wiring-viewport')

    expect(viewport).toContainElement(screen.getByText(/휠·핀치로 최대 500% 확대/))
    expect(viewport).toContainElement(screen.getByRole('button', { name: '배선도 확대' }))
  })

  it('drags the enlarged diagram and resets both zoom and position', () => {
    render(<WiringIllustration recipe={pendulumRecipe} activeStep={0} />)
    const viewport = screen.getByTestId('wiring-viewport')

    fireEvent.wheel(viewport, { deltaY: -500, clientX: 400, clientY: 300 })
    fireEvent.pointerDown(viewport, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 160, clientY: 140 })
    fireEvent.pointerUp(viewport, { pointerId: 1, clientX: 160, clientY: 140 })

    expect(screen.getByTestId('wiring-canvas').getAttribute('style')).toContain('translate(60px, 40px)')
    fireEvent.click(screen.getByRole('button', { name: '배선도 원래 크기' }))
    expect(screen.getByTestId('wiring-canvas')).toHaveStyle({
      transform: 'translate(0px, 0px) scale(1)',
    })
  })

  it('zooms with a two-pointer pinch gesture', () => {
    render(<WiringIllustration recipe={pendulumRecipe} activeStep={0} />)
    const viewport = screen.getByTestId('wiring-viewport')

    fireEvent.pointerDown(viewport, { pointerId: 1, clientX: 300, clientY: 300 })
    fireEvent.pointerDown(viewport, { pointerId: 2, clientX: 500, clientY: 300 })
    fireEvent.pointerMove(viewport, { pointerId: 2, clientX: 700, clientY: 300 })

    expect(screen.getByRole('button', { name: '배선도 원래 크기' })).toHaveTextContent('200%')
  })

  it('renders a generated Wokwi diagram when a remote recipe has no readable layout', () => {
    const recipe = phase5Recipes.find((candidate) => candidate.id === 'S1')!
    const { container } = render(<WiringIllustration recipe={recipe} activeStep={1} />)

    expect(screen.getByRole('img', { name: /Wokwi 배선도 2단계까지 연결됨/ })).toBeInTheDocument()
    expect(container.querySelector('[data-generated-wokwi-diagram="S1"]')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-part-id]').length).toBeGreaterThan(1)
    expect(container.querySelectorAll('[data-wire-id]')).toHaveLength(2)
  })

  it('renders sharp wires behind boards and blinks only the current step', () => {
    const recipe = phase5Recipes.find((candidate) => candidate.id === 'S1')!
    const { container } = render(<WiringIllustration recipe={recipe} activeStep={1} />)
    const diagram = container.querySelector('[data-generated-wokwi-diagram]')
    const wireLayer = diagram?.querySelector('[data-wire-layer="behind-parts"]')
    const firstPart = diagram?.querySelector('[data-part-id]')
    const previous = wireLayer?.querySelector('[data-wire-current="false"]')
    const current = wireLayer?.querySelector('[data-wire-current="true"]')

    expect(wireLayer).not.toBeNull()
    expect(firstPart).not.toBeNull()
    expect(
      wireLayer!.compareDocumentPosition(firstPart!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(previous?.querySelector('[data-wire-line]')).toHaveAttribute('stroke-width', '2')
    expect(previous?.querySelector('[data-wire-halo]')).toBeNull()
    expect(current).toHaveClass('wiring-current-step')
    expect(current?.querySelector('[data-wire-line]')).toHaveAttribute('stroke-width', '2.5')
    expect(current?.querySelector('[data-wire-halo]')).toHaveAttribute('stroke-width', '4.5')
  })

  it('anchors every Phase 5 wire endpoint to a visible pin center', () => {
    for (const recipe of phase5Recipes) {
      const { container, unmount } = render(
        <WiringIllustration recipe={recipe} activeStep={recipe.wiring.length - 1} />,
      )
      const pinPoints = new Set(
        Array.from(container.querySelectorAll('[data-pin-x][data-pin-y]'))
          .map((pin) => `${pin.getAttribute('data-pin-x')},${pin.getAttribute('data-pin-y')}`),
      )
      const wires = Array.from(container.querySelectorAll('[data-wire-from][data-wire-to]'))
      expect(wires, recipe.id).toHaveLength(recipe.wiring.length)
      for (const wire of wires) {
        expect(pinPoints.has(wire.getAttribute('data-wire-from') ?? ''), recipe.id).toBe(true)
        expect(pinPoints.has(wire.getAttribute('data-wire-to') ?? ''), recipe.id).toBe(true)
        const polyline = wire.querySelectorAll('polyline').item(
          wire.querySelectorAll('polyline').length - 1,
        )
        const points = (polyline?.getAttribute('points') ?? '').split(' ').map((value) => {
          const [x, y] = value.split(',').map(Number)
          return { x, y }
        })
        for (let index = 1; index < points.length; index += 1) {
          const previous = points[index - 1]
          const current = points[index]
          expect(
            previous.x === current.x || previous.y === current.y,
            `${recipe.id}: wire segment must be orthogonal`,
          ).toBe(true)
        }
      }
      for (const fallbackPin of Array.from(
        container.querySelectorAll('[data-pin-source="fallback"]'),
      )) {
        expect(fallbackPin.querySelector('text')?.textContent, `${recipe.id}: fallback pin label`)
          .toBeTruthy()
      }
      unmount()
    }
  })

  it('reuses the current sensor SVGs and their measured connector coordinates', () => {
    const expected = [
      ['bme280', 'chip-bme280', 'BME280 온습도 기압 센서 모듈'],
      ['cds', 'wokwi-photoresistor-sensor', 'CDS 조도 센서'],
      ['ds18b20', 'wokwi-ds18b20', 'DS18B20 TO-92 센서'],
      ['hbe0704', 'wokwi-potentiometer', 'HBE0704 TO-92 센서'],
      ['ina219', 'chip-ina219', 'INA219'],
      ['tsl2591', 'chip-tsl2591', 'TSL2591'],
    ] as const

    for (const [sensorId, partType, accessibleName] of expected) {
      const recipe = phase5Recipes.find((candidate) => candidate.sensors.includes(sensorId))!
      const { container, unmount } = render(
        <WiringIllustration recipe={recipe} activeStep={recipe.wiring.length - 1} />,
      )
      const part = container.querySelector(`[data-part-type="${partType}"]`)
      expect(part, `${recipe.id}: ${sensorId} SVG part`).not.toBeNull()
      expect(part?.querySelector(`[role="img"][aria-label*="${accessibleName}"]`)).not.toBeNull()
      expect(part?.querySelectorAll('[data-pin-source="fallback"]')).toHaveLength(0)
      unmount()
    }
  })
})
