import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { AdminAuthState, AdminServices } from '@/admin/AdminServices'
import { AdminShell } from '@/admin/AdminShell'
import { Button } from '@/components/ui/button'
import { AdminDashboardPage } from './AdminDashboardPage'
import { AdminRationalePage } from './AdminRationalePage'
import { AdminRecipeEditorPage } from './AdminRecipeEditorPage'
import { AdminRecipeListPage } from './AdminRecipeListPage'
import { AdminSensorPage } from './AdminSensorPage'

export function AdminPage({ services }: { services: AdminServices }) {
  const [auth, setAuth] = useState<AdminAuthState>(() => services.getAuthState())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signInError, setSignInError] = useState('')

  useEffect(() => services.subscribeAuth(setAuth), [services])

  if (auth.status === 'loading') {
    return <div className="grid min-h-screen place-items-center" role="status">관리자 권한을 확인하는 중…</div>
  }

  if (auth.status === 'signed-out') {
    const signIn = async (event: FormEvent) => {
      event.preventDefault()
      setSignInError('')
      try {
        await services.signIn(email, password)
      } catch (reason) {
        setSignInError(reason instanceof Error ? reason.message : '로그인하지 못했습니다.')
      }
    }
    return (
      <section className="mx-auto max-w-md rounded-card border border-border p-6 text-center">
        <h1 className="text-heading font-semibold">관리자 로그인</h1>
        <p className="my-4 text-muted">승인된 계정으로 로그인하여 레시피와 부품 목록을 관리하세요.</p>
        <form className="space-y-4 text-left" onSubmit={(event) => void signIn(event)}>
          <label className="block">
            <span className="mb-1 block font-medium">이메일</span>
            <input className="w-full rounded-card border border-border bg-background px-3 py-2" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">비밀번호</span>
            <input className="w-full rounded-card border border-border bg-background px-3 py-2" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {signInError && <p role="alert" className="text-caption text-danger">{signInError}</p>}
          <Button className="w-full" type="submit">로그인</Button>
        </form>
      </section>
    )
  }

  if (auth.status === 'access-denied') {
    return (
      <section className="mx-auto max-w-md rounded-card border border-danger bg-danger-background p-6 text-center">
        <h1 className="text-heading font-semibold text-danger">접근 권한 없음</h1>
        <p className="my-4">{auth.email ?? '선택한 계정'}에는 관리자 권한이 없습니다.</p>
        <Button variant="outline" onClick={() => void services.signOut()}>다른 계정 사용</Button>
      </section>
    )
  }

  return (
    <AdminShell email={auth.email} services={services}>
      <Routes>
        <Route index element={<AdminDashboardPage services={services} />} />
        <Route path="recipes" element={<AdminRecipeListPage services={services} />} />
        <Route path="recipes/new" element={<AdminRecipeEditorPage services={services} />} />
        <Route path="recipes/:id" element={<AdminRecipeEditorPage services={services} />} />
        <Route path="sensors" element={<AdminSensorPage services={services} />} />
        <Route path="rationales" element={<AdminRationalePage services={services} />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminShell>
  )
}
