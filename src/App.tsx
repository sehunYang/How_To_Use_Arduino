import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { routerBasename } from '@/lib/basePath'
import { Button } from '@/components/ui/button'

function Home() {
  return (
    <main className="mx-auto max-w-2xl p-page">
      <h1 className="text-heading font-semibold">How to use Arduino</h1>
      <p className="text-body text-muted">
        아두이노를 처음 쓰는 학생을 위한 가이드 사이트 (개발 초기 단계)
      </p>
      <Button className="mt-4">시작하기</Button>
    </main>
  )
}

function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
