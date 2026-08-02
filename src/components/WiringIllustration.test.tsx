// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pendulumRecipe } from '@/data/canary'
import { phase5Recipes } from '@/data/phase5'
import { phase6Recipes } from '@/data/phase6'
import { planBreadboardWiring } from '@/wokwi/buildDiagram'
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
  it('zooms with ctrl and the mouse wheel, capping the vector diagram at 500%', () => {
    render(<WiringIllustration recipe={pendulumRecipe} activeStep={0} />)
    const viewport = screen.getByTestId('wiring-viewport')

    const wheel = new WheelEvent('wheel', {
      deltaY: -2000,
      clientX: 400,
      clientY: 300,
      ctrlKey: true,
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

  /**
   * 배선도는 화면 위에 붙어 화면의 절반 넘게 덮습니다. 맨 휠까지 가로채면 학생이 그림 위에
   * 마우스를 둔 채 굴려도 페이지가 움직이지 않아, 화면 대부분이 스크롤이 죽은 자리가 됩니다.
   */
  it('lets a plain wheel scroll the page instead of zooming', () => {
    render(<WiringIllustration recipe={pendulumRecipe} activeStep={0} />)
    const viewport = screen.getByTestId('wiring-viewport')

    const wheel = new WheelEvent('wheel', {
      deltaY: -2000,
      clientX: 400,
      clientY: 300,
      bubbles: true,
      cancelable: true,
    })
    fireEvent(viewport, wheel)

    expect(wheel.defaultPrevented).toBe(false)
    expect(screen.getByRole('button', { name: '배선도 원래 크기' })).toHaveTextContent('100%')
  })

  /**
   * 확대는 단추로 되지만 옮기기는 끌기뿐이었습니다. 키보드만 쓰는 학생은 500%까지 키운 뒤
   * 가운데밖에 볼 수 없어 확대가 사실상 쓸모없었습니다.
   */
  it('zooms and pans from the keyboard alone', () => {
    render(<WiringIllustration recipe={pendulumRecipe} activeStep={0} />)
    const viewport = screen.getByTestId('wiring-viewport')
    expect(viewport).toHaveAttribute('tabindex', '0')

    fireEvent.keyDown(viewport, { key: '+' })
    expect(screen.getByRole('button', { name: '배선도 원래 크기' })).toHaveTextContent('150%')

    fireEvent.keyDown(viewport, { key: 'ArrowRight' })
    expect(screen.getByTestId('wiring-canvas').getAttribute('style')).toContain('translate(-24px, 0px)')

    fireEvent.keyDown(viewport, { key: '0' })
    expect(screen.getByTestId('wiring-canvas')).toHaveStyle({ transform: 'translate(0px, 0px) scale(1)' })
  })

  /** 100%일 때 화살표까지 가로채면 그림 위에서 페이지를 넘길 수 없는 덫이 됩니다. */
  it('leaves the arrow keys to the page while the diagram is not enlarged', () => {
    render(<WiringIllustration recipe={pendulumRecipe} activeStep={0} />)
    const viewport = screen.getByTestId('wiring-viewport')

    const arrow = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    fireEvent(viewport, arrow)

    expect(arrow.defaultPrevented).toBe(false)
  })

  it('describes the current step for screen readers', () => {
    render(<WiringIllustration recipe={pendulumRecipe} activeStep={1} />)
    const step = pendulumRecipe.wiring[1]

    expect(screen.getByText(new RegExp(`${step.from}.*${step.to}.*${step.color}`))).toBeInTheDocument()
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

    fireEvent.wheel(viewport, { deltaY: -500, clientX: 400, clientY: 300, ctrlKey: true })
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
    expect(container.querySelectorAll('[data-wire-id]')).toHaveLength(4)
  })

  it('renders sharp wires above boards, below labels, and blinks only the current step', () => {
    const recipe = phase5Recipes.find((candidate) => candidate.id === 'S1')!
    const { container } = render(<WiringIllustration recipe={recipe} activeStep={1} />)
    const diagram = container.querySelector('[data-generated-wokwi-diagram]')
    const wireLayer = diagram?.querySelector('[data-wire-layer="above-boards"]')
    const firstPart = diagram?.querySelector('[data-part-id]')
    const firstOverlay = diagram?.querySelector('[data-part-overlay]')
    const previous = wireLayer?.querySelector('[data-wire-current="false"]')
    const currentWires = Array.from(wireLayer?.querySelectorAll('[data-wire-current="true"]') ?? [])
    const current = currentWires[0]

    expect(wireLayer).not.toBeNull()
    expect(firstPart).not.toBeNull()
    expect(firstOverlay).not.toBeNull()
    expect(
      firstPart!.compareDocumentPosition(wireLayer!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      wireLayer!.compareDocumentPosition(firstOverlay!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(previous?.querySelector('[data-wire-line]')).toHaveAttribute('stroke-width', '2')
    expect(previous).toHaveAttribute('opacity', '0.32')
    expect(previous?.querySelector('[data-wire-halo]')).toBeNull()
    expect(previous?.querySelector('[data-wire-blink]')).toBeNull()
    expect(current).toHaveAttribute('opacity', '1')
    expect(current?.querySelector('[data-wire-blink]')).toHaveAttribute('dur', '3s')
    expect(current?.querySelector('[data-wire-blink]')).toHaveAttribute('repeatCount', 'indefinite')
    expect(currentWires.map((wire) => wire.querySelector('[data-wire-blink]')?.getAttribute('begin')))
      .toEqual(['0s', '-1.5s'])
    expect(current?.querySelector('[data-wire-line]')).toHaveAttribute('stroke-width', '2.5')
    expect(current?.querySelector('[data-wire-halo]')).toHaveAttribute('stroke-width', '4.5')
  })

  it('routes the UNO-to-rail and rail-to-sensor wires without overlapping segments', () => {
    const { container } = render(<WiringIllustration recipe={pendulumRecipe} activeStep={0} />)
    const wireLines = Array.from(container.querySelectorAll('[data-wire-line]'))
    expect(wireLines).toHaveLength(2)
    const breadboard = container.querySelector('[data-part-id="bb"]')!
    const boardLeft = Number(breadboard.getAttribute('data-part-left'))
    const boardTop = Number(breadboard.getAttribute('data-part-top'))

    const segments = (line: Element) => {
      const points = (line.getAttribute('points') ?? '').split(' ').map((point) => {
        const [x, y] = point.split(',').map(Number)
        return { x, y }
      })
      return points.slice(1).map((end, index) => ({ start: points[index], end }))
    }
    const overlaps = (left: ReturnType<typeof segments>[number], right: ReturnType<typeof segments>[number]) => {
      if (left.start.x === left.end.x && right.start.x === right.end.x) {
        if (left.start.x !== right.start.x) return false
        const overlap = Math.min(Math.max(left.start.y, left.end.y), Math.max(right.start.y, right.end.y))
          - Math.max(Math.min(left.start.y, left.end.y), Math.min(right.start.y, right.end.y))
        return overlap > 0.01
      }
      if (left.start.y === left.end.y && right.start.y === right.end.y) {
        if (left.start.y !== right.start.y) return false
        const overlap = Math.min(Math.max(left.start.x, left.end.x), Math.max(right.start.x, right.end.x))
          - Math.max(Math.min(left.start.x, left.end.x), Math.min(right.start.x, right.end.x))
        return overlap > 0.01
      }
      return false
    }

    for (const left of segments(wireLines[0])) {
      for (const right of segments(wireLines[1])) {
        expect(overlaps(left, right)).toBe(false)
      }
    }

    for (const wire of Array.from(container.querySelectorAll('[data-wire-to-pin^="bb:"]'))) {
      const points = (wire.querySelector('[data-wire-line]')?.getAttribute('points') ?? '')
        .split(' ')
        .map((point) => point.split(',').map(Number))
      const outsideCorner = points.at(-3)!
      const abovePin = points.at(-2)!
      const pin = points.at(-1)!
      expect(outsideCorner[0]).toBeLessThan(boardLeft)
      expect(outsideCorner[1]).toBeLessThan(boardTop)
      expect(abovePin[0]).toBe(pin[0])
      expect(abovePin[1]).toBeLessThan(boardTop)
    }
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
      const mountedLeadCount = container.querySelectorAll('[data-board-mounted-part]').length * 2
      const expectedWires = planBreadboardWiring(recipe).length - mountedLeadCount
      expect(wires, recipe.id).toHaveLength(expectedWires)
      expect(container.querySelector('[data-part-id="bb"]'), recipe.id).not.toBeNull()
      const svg = container.querySelector('[data-generated-wokwi-diagram]')!
      const [viewX, viewY, viewWidth, viewHeight] = (svg.getAttribute('viewBox') ?? '')
        .split(' ')
        .map(Number)
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
        for (const point of points) {
          expect(point.x, `${recipe.id}: wire x must remain inside sketch`).toBeGreaterThanOrEqual(viewX)
          expect(point.x, `${recipe.id}: wire x must remain inside sketch`).toBeLessThanOrEqual(viewX + viewWidth)
          expect(point.y, `${recipe.id}: wire y must remain inside sketch`).toBeGreaterThanOrEqual(viewY)
          expect(point.y, `${recipe.id}: wire y must remain inside sketch`).toBeLessThanOrEqual(viewY + viewHeight)
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

  it('mounts resistor leads directly in breadboard holes with concrete resistance labels', () => {
    const recipe = phase5Recipes.find((candidate) => candidate.id === 'S4')!
    const { container } = render(
      <WiringIllustration recipe={recipe} activeStep={recipe.wiring.length - 1} />,
    )
    const resistor = container.querySelector('[data-part-id="cds_resistor"]')
    expect(resistor).toHaveAttribute('data-mounted-resistor', 'cds_resistor')
    expect(resistor?.getAttribute('data-resistor-pin-1')).toMatch(/^\d+(?:\.\d+)?,\d+(?:\.\d+)?$/)
    expect(resistor?.getAttribute('data-resistor-pin-2')).toMatch(/^\d+(?:\.\d+)?,\d+(?:\.\d+)?$/)
    expect(resistor?.querySelectorAll('line')).toHaveLength(6)
    expect(container.querySelector('[data-part-overlay="cds_resistor"]')).toHaveTextContent('10 kΩ')
    expect(container.textContent).not.toContain('CDS RESISTOR')
  })

  it('connects battery negative to the common ground rail in the internal-resistance recipe', () => {
    const recipe = phase6Recipes.find((candidate) => candidate.id === 'ph22-battery-internal-resistance')!
    const { container } = render(
      <WiringIllustration recipe={recipe} activeStep={recipe.wiring.length - 1} />,
    )

    expect(recipe.wiring).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'BATTERY.-', to: 'UNO.GND', color: 'black' }),
    ]))
    expect(container.querySelector('[data-mounted-resistor="resistor_220"]')).not.toBeNull()
    expect(container.querySelector('[data-wire-from-pin="battery:GND"][data-wire-to-pin^="bb:tn."]'))
      .not.toBeNull()
    expect(container.querySelector('[data-wire-from-pin="uno:GND"][data-wire-to-pin="bb:tn.1"]'))
      .not.toBeNull()
    expect(container.querySelector('[data-part-id="battery"][data-part-type="wokwi-slide-potentiometer"]'))
      .not.toBeNull()
    expect(container.querySelector('[data-pin="battery:SIG"]')).toHaveAttribute('data-pin-source', 'verified')
    expect(container.querySelector('[data-pin="battery:GND"]')).toHaveAttribute('data-pin-source', 'verified')
    expect(container.querySelector('[data-wire-from-pin="battery:SIG"]'))
      .toHaveAttribute('data-wire-from', container.querySelector('[data-pin="battery:SIG"]')?.getAttribute('data-pin-x')
        + ',' + container.querySelector('[data-pin="battery:SIG"]')?.getAttribute('data-pin-y'))
    expect(container.querySelector('[data-wire-from-pin="battery:GND"]'))
      .toHaveAttribute('data-wire-from', container.querySelector('[data-pin="battery:GND"]')?.getAttribute('data-pin-x')
        + ',' + container.querySelector('[data-pin="battery:GND"]')?.getAttribute('data-pin-y'))
  })

  it('mounts LED and buzzer leads directly in breadboard holes', () => {
    const recipe = phase5Recipes.find((candidate) => candidate.id === 'parking-alarm')!
    const { container } = render(
      <WiringIllustration recipe={recipe} activeStep={recipe.wiring.length - 1} />,
    )
    const planned = planBreadboardWiring(recipe)
    for (const token of ['LED.', 'BUZZER.']) {
      const mountedConnections = planned.filter(({ from }) => from.startsWith(token))
      expect(mountedConnections).toHaveLength(2)
      expect(mountedConnections.every(({ to }) => /^BB\.\d+t\.e$/.test(to))).toBe(true)
    }

    expect(container.querySelector('[data-mounted-led="led"]')).not.toBeNull()
    expect(container.querySelector('[data-mounted-buzzer="buzzer"]')).not.toBeNull()
    for (const partId of ['led', 'buzzer']) {
      const mounted = container.querySelector(`[data-board-mounted-part="${partId}"]`)!
      const pin1 = mounted.getAttribute('data-resistor-pin-1')
      const pin2 = mounted.getAttribute('data-resistor-pin-2')
      expect(pin1).not.toBe(pin2)
      expect(container.querySelector(`[data-part-overlay="${partId}"] [data-pin-source="breadboard-hole"]`))
        .not.toBeNull()
      for (const pin of Array.from(container.querySelectorAll(`[data-part-overlay="${partId}"] [data-pin]`))) {
        const matchingWireEndpoint = Array.from(container.querySelectorAll(`[data-wire-from-pin="${pin.getAttribute('data-pin')}"], [data-wire-to-pin="${pin.getAttribute('data-pin')}"]`))
        expect(matchingWireEndpoint).toHaveLength(0)
        const point = `${pin.getAttribute('data-pin-x')},${pin.getAttribute('data-pin-y')}`
        expect([pin1, pin2]).toContain(point)
      }
      const legs = Array.from(mounted.querySelectorAll('line')).slice(0, 2)
      expect(legs).toHaveLength(2)
      for (const leg of legs) {
        expect(Number(leg.getAttribute('y1'))).toBeGreaterThan(Number(leg.getAttribute('y2')))
      }
      expect(container.querySelector(`[data-wire-from-pin^="${partId}:"][data-wire-to-pin^="bb:"]`))
        .toBeNull()
    }
    const mountedBounds = Array.from(container.querySelectorAll('[data-board-mounted-part]')).map((part) => ({
      id: part.getAttribute('data-board-mounted-part'),
      left: Number(part.getAttribute('data-part-left')),
      top: Number(part.getAttribute('data-part-top')),
      right: Number(part.getAttribute('data-part-left')) + Number(part.getAttribute('data-part-width')),
      bottom: Number(part.getAttribute('data-part-top')) + Number(part.getAttribute('data-part-height')),
    }))
    for (let leftIndex = 0; leftIndex < mountedBounds.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < mountedBounds.length; rightIndex += 1) {
        const left = mountedBounds[leftIndex]
        const right = mountedBounds[rightIndex]
        const overlaps = left.left < right.right && left.right > right.left
          && left.top < right.bottom && left.bottom > right.top
        expect(overlaps, `${left.id} and ${right.id} must not overlap`).toBe(false)
      }
    }
    expect(container.querySelector('[data-wire-from-pin^="bb:tn."][data-wire-to-pin$="t.a"]'))
      .not.toBeNull()
  })

  it('uses TSL2591 instead of CDS for the precision lens focal-length experiment', () => {
    const recipe = phase6Recipes.find((candidate) => candidate.id === 'ph31-lens-focal-length')!

    expect(recipe.sensors).toEqual(['tsl2591'])
    expect(recipe.body).toContain('TSL2591 정밀 조도센서')
    expect(recipe.wiring.some((step) => step.from.startsWith('CDS.'))).toBe(false)
    expect(recipe.wiring.some((step) => step.from === 'TSL2591.SDA')).toBe(true)
  })

  it('reuses the current sensor SVGs and their measured connector coordinates', () => {
    const expected = [
      ['bme280', 'chip-bme280', 'BME280 온습도 기압 센서 모듈'],
      ['cds', 'visual-cds', 'CDS 2선 광저항'],
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
