import { BrowserRouter, Link, Routes, Route, useParams } from 'react-router-dom'
import { routerBasename } from '@/lib/basePath'
import { AppShell } from '@/components/AppShell'
import { DiscoveryPage } from '@/pages/DiscoveryPage'
import { SearchResultsPage } from '@/pages/SearchResultsPage'
import { RecipeListPage } from '@/pages/RecipeListPage'
import { RecipeDetailPage } from '@/pages/RecipeDetailPage'
import { SensorListPage } from '@/pages/SensorListPage'
import { SensorDetailPage } from '@/pages/SensorDetailPage'

function RecipeRoute() {
  const { id } = useParams()
  return <RecipeDetailPage key={id} />
}

function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <AppShell>
        <Routes>
          <Route path="/" element={<DiscoveryPage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/recipes" element={<RecipeListPage />} />
          <Route path="/recipes/:id" element={<RecipeRoute />} />
          <Route path="/sensors" element={<SensorListPage />} />
          <Route path="/sensors/:id" element={<SensorDetailPage />} />
          <Route path="*" element={<div className="py-20 text-center"><h1 className="text-3xl font-semibold">페이지를 찾을 수 없어요</h1><Link className="mt-4 inline-block text-accent" to="/">처음으로</Link></div>} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}

export default App
