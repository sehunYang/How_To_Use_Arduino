// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { SensorListPage } from './SensorListPage'
import { SensorDetailPage } from './SensorDetailPage'

function renderRoute(path: string) {
  window.history.replaceState({}, '', path)
  return render(
    <BrowserRouter>
      <Routes>
        <Route path="/sensors" element={<SensorListPage />} />
        <Route path="/sensors/:id" element={<SensorDetailPage />} />
      </Routes>
    </BrowserRouter>,
  )
}

afterEach(cleanup)

describe('sensor learning flow', () => {
  it('shows the ten inventory parts as a sensor gallery', () => {
    renderRoute('/sensors')
    expect(screen.getByRole('heading', { name: '센서 학습하기' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /센서 자세히 보기/ })).toHaveLength(10)
    expect(screen.getByText('전류 · 전압 · 전력')).toBeInTheDocument()
  })

  it('filters the gallery by a measured physical quantity', async () => {
    renderRoute('/sensors')
    await userEvent.type(screen.getByPlaceholderText('예: 온도, 거리, 조도'), '거리')
    expect(screen.getByRole('heading', { name: 'HC-SR04' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'MPU6050' })).not.toBeInTheDocument()
  })

  it('shows output, detailed specs, experiments, cautions, and related recipes', () => {
    renderRoute('/sensors/mpu6050')
    expect(screen.getByRole('heading', { name: 'MPU6050' })).toBeInTheDocument()
    expect(screen.getByText(/I2C 16비트 축별 값/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '구체적인 스펙' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '추천 실험' })).toBeInTheDocument()
    expect(screen.getByText('단진자의 주기 측정')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '이 센서를 사용하는 레시피' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /레시피 보기/ })).toBeInTheDocument()
  })
})
