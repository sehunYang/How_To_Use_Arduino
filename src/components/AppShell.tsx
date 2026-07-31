import { useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'

const navigation = [
  { to: '/', label: '아이디어 찾기' },
  { to: '/recipes', label: '레시피 둘러보기' },
  { to: '/sensors', label: '센서 학습하기' },
  { to: '/data-converter', label: '데이터 변환하기' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [treeOpen, setTreeOpen] = useState(true)
  const links = navigation.map((item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === '/'}
      onClick={() => setOpen(false)}
      className={({ isActive }) =>
        `block rounded-card px-3 py-2 text-body ${isActive ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-muted-background'}`
      }
    >
      {item.label}
    </NavLink>
  ))

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-page py-3">
          <Link to="/" className="font-semibold tracking-tight">Arduino Compass</Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              className="md:hidden"
              variant="outline"
              size="sm"
              aria-expanded={open}
              aria-controls="mobile-navigation"
              onClick={() => setOpen((value) => !value)}
            >
              메뉴
            </Button>
          </div>
        </div>
      </header>
      <div className="app-layout mx-auto max-w-screen-2xl">
        <aside className="hidden min-h-[calc(100dvh-4rem)] border-r border-border p-page md:block">
          <nav aria-label="학습 메뉴" className="sticky top-20">
            <button
              className="flex w-full items-center justify-between rounded-card px-3 py-2 font-semibold hover:bg-muted-background"
              aria-expanded={treeOpen}
              aria-controls="student-navigation-tree"
              onClick={() => setTreeOpen((value) => !value)}
            >
              학생 가이드 <span aria-hidden="true">{treeOpen ? '▾' : '▸'}</span>
            </button>
            {treeOpen && <div id="student-navigation-tree" className="mt-1 space-y-1 border-l border-border pl-3">{links}</div>}
          </nav>
        </aside>
        {open && (
          <nav id="mobile-navigation" aria-label="모바일 메뉴" className="border-b border-border p-page md:hidden">
            {links}
          </nav>
        )}
        <main className="min-w-0 p-page">{children}</main>
      </div>
    </div>
  )
}
