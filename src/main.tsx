import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { stripCacheBustParam } from '@/lib/cacheBust'
import './styles/tokens.css'

// 배포 직후 새 코드를 받으려고 붙였던 표시는 화면을 그리기 전에 주소에서 지웁니다.
stripCacheBustParam()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
