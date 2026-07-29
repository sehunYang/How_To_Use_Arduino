import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { AdminServices } from './AdminServices'

const links = [
  { to: '/admin', label: '대시보드', end: true },
  { to: '/admin/recipes', label: '레시피' },
  { to: '/admin/sensors', label: '센서' },
  { to: '/admin/rationales', label: '활용 근거' },
]

export function AdminShell({
  children,
  email,
  services,
}: {
  children: ReactNode
  email: string
  services: AdminServices
}) {
  return (
    <section className="mx-auto max-w-screen-2xl">
      <div className="mb-6 flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-caption font-semibold tracking-wide text-accent">관리자 작업 공간</p>
          <h1 className="text-heading font-semibold">Arduino Compass 콘텐츠 관리</h1>
          <p className="text-caption text-muted">{email} 계정으로 로그인됨</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void services.signOut()}>로그아웃</Button>
      </div>
      <nav aria-label="관리자 메뉴" className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-card px-4 py-2 font-medium ${isActive ? 'bg-accent text-accent-foreground' : 'border border-border hover:bg-muted-background'}`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      {children}
    </section>
  )
}
