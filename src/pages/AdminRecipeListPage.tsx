import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AdminRecipeDraft, AdminServices } from '@/admin/AdminServices'
import { Button } from '@/components/ui/button'

export function AdminRecipeListPage({ services }: { services: AdminServices }) {
  const [recipes, setRecipes] = useState<AdminRecipeDraft[] | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    void services.listRecipes().then(setRecipes).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : '레시피를 불러오지 못했습니다.')
    })
  }, [services])

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-heading font-semibold">레시피</h2>
          <p className="text-muted">레시피를 작성하고 공개하거나 기기 검증을 요청합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void services.rebuildSearchIndex()
              .then(() => setMessage('검색 인덱스를 다시 생성했습니다.'))
              .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '검색 인덱스를 생성하지 못했습니다.'))}
          >
            검색 인덱스 재생성
          </Button>
          <Link to="/admin/recipes/new"><Button>새 레시피</Button></Link>
        </div>
      </div>
      {message && <p role="status" className="mb-4 rounded-card bg-muted-background p-3">{message}</p>}
      {error && <p role="alert" className="rounded-card bg-danger-background p-4 text-danger">{error}</p>}
      {!recipes && !error && <p role="status">레시피를 불러오는 중…</p>}
      {recipes && (
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full min-w-screen text-left">
            <thead className="bg-muted-background">
              <tr>
                <th className="p-3">제목</th>
                <th className="p-3">유형</th>
                <th className="p-3">상태</th>
                <th className="p-3"><span className="sr-only">작업</span></th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((recipe) => (
                <tr key={recipe.id} className="border-t border-border">
                  <td className="p-3 font-medium">{recipe.title}</td>
                  <td className="p-3">{recipe.type === 'project' ? '프로젝트' : '센서 예제'}</td>
                  <td className="p-3">{recipe.status === 'draft' ? '작성 중' : '공개됨'}</td>
                  <td className="p-3 text-right"><Link className="text-accent underline" to={`/admin/recipes/${recipe.id}`}>편집</Link></td>
                </tr>
              ))}
              {recipes.length === 0 && <tr><td className="p-6 text-center text-muted" colSpan={4}>등록된 레시피가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
