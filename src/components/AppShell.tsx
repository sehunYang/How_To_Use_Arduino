import { useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'

const guideNavigation = [
  { to: '/', label: '아이디어 찾기' },
  { to: '/recipes', label: '레시피 둘러보기' },
  { to: '/sensors', label: '센서 학습하기' },
]

/**
 * 데이터 변환·분석은 학생 가이드의 하위 항목이 아니라 같은 높이의 메뉴입니다.
 * 레시피를 따라 회로를 만든 뒤 측정한 값을 다루는 별개의 작업이라, 가이드 안에
 * 숨어 있으면 실험을 마친 학생이 찾기 어렵습니다.
 */
const dataAnalysisNavigation = { to: '/data-analysis', label: '데이터 변환·분석' }

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [treeOpen, setTreeOpen] = useState(true)

  const guideLinks = guideNavigation.map((item) => (
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

  const dataAnalysisLink = (
    <NavLink
      to={dataAnalysisNavigation.to}
      onClick={() => setOpen(false)}
      className={({ isActive }) =>
        `block rounded-card px-3 py-2 font-semibold ${isActive ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-muted-background'}`
      }
    >
      {dataAnalysisNavigation.label}
    </NavLink>
  )

  // 데스크톱 사이드바와 모바일 메뉴가 같은 목록을 그리므로, 펼침 상태를 가리키는
  // id는 화면마다 달라야 두 곳에 같은 id가 생기지 않습니다.
  const renderMenu = (scope: string) => {
    const treeId = `${scope}-navigation-tree`
    return (
      <>
        <button
          className="flex w-full items-center justify-between rounded-card px-3 py-2 font-semibold hover:bg-muted-background"
          aria-expanded={treeOpen}
          aria-controls={treeId}
          onClick={() => setTreeOpen((value) => !value)}
        >
          학생 가이드 <span aria-hidden="true">{treeOpen ? '▾' : '▸'}</span>
        </button>
        {treeOpen && <div id={treeId} className="mt-1 space-y-1 border-l border-border pl-3">{guideLinks}</div>}
        <div className="mt-2">{dataAnalysisLink}</div>
      </>
    )
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/*
        화면마다 머리글과 메뉴 링크 다섯 개가 먼저 나옵니다. 키보드나 화면 낭독기로
        읽는 학생은 화면을 옮길 때마다 그 앞부분을 처음부터 다시 지나야 했습니다.
      */}
      <a
        href="#main-content"
        className="sr-only rounded-card bg-accent px-4 py-2 text-accent-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        본문 바로가기
      </a>
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
        {/*
          이 자리는 메뉴를 담는 칸일 뿐이고 landmark는 안쪽 nav입니다. aside로 두면 이름 없는
          '보조' 영역이 하나 더 생겨, 화면에 다른 aside(이어서 하기 안내)가 뜨는 순간 둘을
          구별할 수 없게 됩니다.
        */}
        <div className="hidden min-h-[calc(100dvh-4rem)] border-r border-border p-page md:block">
          <nav aria-label="학습 메뉴" className="sticky top-20">{renderMenu('student')}</nav>
        </div>
        {open && (
          <nav id="mobile-navigation" aria-label="모바일 메뉴" className="border-b border-border p-page md:hidden">
            {renderMenu('mobile')}
          </nav>
        )}
        <main id="main-content" tabIndex={-1} className="min-w-0 p-page">{children}</main>
      </div>
    </div>
  )
}
