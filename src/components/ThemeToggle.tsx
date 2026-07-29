import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const saved = window.localStorage.getItem('arduino-theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('arduino-theme', theme)
  }, [theme])

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={`현재 ${theme === 'dark' ? '다크' : '라이트'} 모드. 테마 전환`}
      onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
    >
      {theme === 'dark' ? '☀️ 라이트' : '🌙 다크'}
    </Button>
  )
}
