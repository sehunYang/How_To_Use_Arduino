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
})
