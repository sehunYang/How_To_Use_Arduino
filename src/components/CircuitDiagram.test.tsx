// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach } from 'vitest'
import { describe, expect, it } from 'vitest'
import { CircuitDiagram } from './CircuitDiagram'
import { ina219CurrentLayout } from '@/wokwi/layouts/ina219CurrentLayout'
import { multiTsl2591Layout } from '@/wokwi/layouts/multiTsl2591Layout'

afterEach(cleanup)

describe('CircuitDiagram', () => {
  it('renders only the wires accumulated through the active step', () => {
    const { container, rerender } = render(
      <CircuitDiagram layout={ina219CurrentLayout} activeStep={0} title="INA219" />,
    )
    expect(container.querySelectorAll('[data-wire-id]')).toHaveLength(1)

    rerender(<CircuitDiagram layout={ina219CurrentLayout} activeStep={2} title="INA219" />)
    expect(container.querySelectorAll('[data-wire-id]')).toHaveLength(3)
    expect(screen.getByRole('img', { name: /3단계까지 연결됨/ })).toBeTruthy()
  })

  it('uses registered Wokwi parts and the custom INA219 artwork', () => {
    const { container } = render(
      <CircuitDiagram layout={ina219CurrentLayout} activeStep={3} title="INA219" />,
    )
    expect(container.querySelector('wokwi-arduino-uno')).toBeTruthy()
    expect(within(container).getByRole('img', { name: 'INA219 전류 센서 모듈' })).toBeTruthy()
  })

  it('renders the powered TCA9548A circuit through all sixteen teaching steps', () => {
    const { container } = render(
      <CircuitDiagram layout={multiTsl2591Layout} activeStep={15} title="다중 조도센서" />,
    )

    expect(container.querySelector('[data-part-id="tca9548a"]')).toBeTruthy()
    expect(container.querySelector('[data-part-id="bb"]')).toBeTruthy()
    expect(container.querySelectorAll('[data-wire-id]')).toHaveLength(16)
    expect(within(container).getByRole('img', { name: /16단계까지 연결됨/ })).toBeTruthy()
  })
})
