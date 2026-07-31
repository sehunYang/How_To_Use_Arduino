import { lazy, Suspense } from 'react'
import { BrowserRouter, Link, Navigate, Routes, Route, useParams } from 'react-router-dom'
import { routerBasename } from '@/lib/basePath'
import { AppShell } from '@/components/AppShell'
import { type AdminServices } from '@/admin/AdminServices'

/**
 * 화면은 모두 필요할 때 내려받습니다.
 *
 * 전부 정적으로 가져오면 수식 렌더러(KaTeX), 마크다운 변환기, 브레드보드 부품
 * 그림, 관리자 화면이 첫 화면 번들에 함께 실립니다. 레시피 상세에서만 쓰는
 * 코드가 대부분이라 첫 화면 크기 예산(`SIZE_BUDGETS.initialJsGzipBytes`)을
 * 크게 넘겼습니다. 화면 단위로 나누면 학생이 실제로 연 화면의 코드만 받습니다.
 *
 * 이름을 붙여 내보낸 컴포넌트라 `default`로 감싸 주어야 `lazy()`가 읽습니다.
 */
const DiscoveryPage = lazy(async () => ({ default: (await import('@/pages/DiscoveryPage')).DiscoveryPage }))
const SearchResultsPage = lazy(async () => ({ default: (await import('@/pages/SearchResultsPage')).SearchResultsPage }))
const RecipeListPage = lazy(async () => ({ default: (await import('@/pages/RecipeListPage')).RecipeListPage }))
const RecipeDetailPage = lazy(async () => ({ default: (await import('@/pages/RecipeDetailPage')).RecipeDetailPage }))
const SensorListPage = lazy(async () => ({ default: (await import('@/pages/SensorListPage')).SensorListPage }))
const SensorDetailPage = lazy(async () => ({ default: (await import('@/pages/SensorDetailPage')).SensorDetailPage }))
const DataAnalysisPage = lazy(async () => ({ default: (await import('@/pages/DataAnalysisPage')).DataAnalysisPage }))

/**
 * 관리자 화면과 그 Firebase 어댑터를 한 덩어리로 묶어 함께 내려받습니다.
 * 어댑터를 App에서 바로 가져오면(예전 기본 매개변수 방식) 학생만 쓰는 화면에도
 * 관리자용 코드가 딸려 들어옵니다. `services`를 넘기면 그 값을 쓰므로 테스트는
 * 지금처럼 가짜 구현을 주입할 수 있습니다.
 */
const AdminRoute = lazy(async () => {
  const [{ AdminPage }, { firebaseAdminServices }] = await Promise.all([
    import('@/pages/AdminPage'),
    import('@/firebase/adminServices'),
  ])
  return {
    default: ({ services }: { services?: AdminServices }) => (
      <AdminPage services={services ?? firebaseAdminServices} />
    ),
  }
})

/** 화면 코드를 받는 동안 보여 줄 자리. 화면 낭독기에도 상태가 전달됩니다. */
export const PAGE_LOADING_LABEL = '페이지를 불러오는 중입니다'

function PageLoading() {
  return (
    <div role="status" aria-live="polite" className="py-20 text-center text-muted">
      {PAGE_LOADING_LABEL}
    </div>
  )
}

function RecipeRoute() {
  const { id } = useParams()
  return <RecipeDetailPage key={id} />
}

function App({ adminServices }: { adminServices?: AdminServices }) {
  return (
    <BrowserRouter basename={routerBasename}>
      <AppShell>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/" element={<DiscoveryPage />} />
            <Route path="/search" element={<SearchResultsPage />} />
            <Route path="/recipes" element={<RecipeListPage />} />
            <Route path="/recipes/:id" element={<RecipeRoute />} />
            <Route path="/sensors" element={<SensorListPage />} />
            <Route path="/sensors/:id" element={<SensorDetailPage />} />
            <Route path="/data-analysis" element={<DataAnalysisPage />} />
            {/* 변환 전용 화면이던 시절의 주소를 저장해 둔 학생이 있어 새 주소로 넘겨 줍니다. */}
            <Route path="/data-converter" element={<Navigate to="/data-analysis" replace />} />
            <Route path="/admin/*" element={<AdminRoute services={adminServices} />} />
            <Route path="*" element={<div className="py-20 text-center"><h1 className="text-3xl font-semibold">페이지를 찾을 수 없어요</h1><Link className="mt-4 inline-block text-accent" to="/">처음으로</Link></div>} />
          </Routes>
        </Suspense>
      </AppShell>
    </BrowserRouter>
  )
}

export default App
