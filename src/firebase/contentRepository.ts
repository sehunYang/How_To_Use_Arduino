import {
  RecipeSchema,
  SearchIndexEntrySchema,
  type Recipe,
  type SearchIndexEntry,
} from '@/schema'
import { publishedRecipes as bundledRecipes } from '@/data/studentCatalog'
import { useEffect, useState } from 'react'
import { ensureAppCheck, getClientApp } from './clientApp'

async function publicFirestore() {
  const app = await getClientApp()
  if (!app || !(await ensureAppCheck(app))) return null
  const { getFirestore } = await import('firebase/firestore')
  return getFirestore(app)
}

/** Loads one public recipe. Draft documents remain unreadable by rules and are rejected defensively here. */
export async function loadPublishedRecipe(recipeId: string): Promise<Recipe | null> {
  const db = await publicFirestore()
  if (!db) return null
  const { doc, getDoc } = await import('firebase/firestore')
  const snapshot = await getDoc(doc(db, 'recipes', recipeId))
  if (!snapshot.exists()) return null
  const parsed = RecipeSchema.safeParse({ ...snapshot.data(), id: snapshot.id })
  return parsed.success && parsed.data.status === 'published' ? parsed.data : null
}

export async function loadPublishedRecipes(maxRecipes = 100): Promise<Recipe[]> {
  const db = await publicFirestore()
  if (!db) return []
  const { collection, getDocs, limit, query, where } = await import('firebase/firestore')
  const snapshot = await getDocs(query(
    collection(db, 'recipes'),
    where('status', '==', 'published'),
    limit(Math.max(1, Math.min(maxRecipes, 100))),
  ))
  return snapshot.docs.flatMap((entry) => {
    const parsed = RecipeSchema.safeParse({ ...entry.data(), id: entry.id })
    return parsed.success && parsed.data.status === 'published' ? [parsed.data] : []
  })
}

export async function loadDynamicSearchIndex(): Promise<SearchIndexEntry[] | null> {
  const db = await publicFirestore()
  if (!db) return null
  const { doc, getDoc } = await import('firebase/firestore')
  const snapshot = await getDoc(doc(db, 'meta', 'index'))
  if (!snapshot.exists() || !Array.isArray(snapshot.data().entries)) return null
  const parsed = SearchIndexEntrySchema.array().safeParse(snapshot.data().entries)
  return parsed.success ? parsed.data : null
}

export function mergePublishedRecipes(
  bundled: Recipe[],
  remote: Recipe[],
): Recipe[] {
  const byId = new Map(
    bundled
      .filter((recipe) => recipe.status === 'published')
      .map((recipe) => [recipe.id, recipe]),
  )
  for (const recipe of remote) {
    if (recipe.status === 'published') byId.set(recipe.id, recipe)
  }
  return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title, 'ko'))
}

export function applyPublishedIndex(
  bundled: Recipe[],
  remote: Recipe[],
  index: SearchIndexEntry[] | null,
): Recipe[] {
  if (!index) return mergePublishedRecipes(bundled, remote)
  const publishedIds = new Set(index.map((entry) => entry.id))
  return mergePublishedRecipes(
    bundled.filter((recipe) => publishedIds.has(recipe.id)),
    remote,
  )
}

/**
 * 게시된 레시피 목록이 어디까지 왔는지.
 * `failed`는 번들에 든 레시피 몇 개만 보이는 상태입니다. 학생에게 말해 주지 않으면
 * 사이트에 온도 탐구가 아예 없다고 믿고 떠납니다.
 */
export type PublishedCatalogStatus = 'loading' | 'ready' | 'failed'

export function usePublishedCatalog(): { recipes: Recipe[]; status: PublishedCatalogStatus } {
  const [recipes, setRecipes] = useState<Recipe[]>(bundledRecipes)
  const [status, setStatus] = useState<PublishedCatalogStatus>('loading')

  useEffect(() => {
    let active = true
    // Firebase 설정이 없는 빌드(로컬 개발, 포크)는 번들의 레시피가 전부라서 실패가 아닙니다.
    const configured = Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID)
    void Promise.all([loadPublishedRecipes(), loadDynamicSearchIndex()])
      .then(([remote, index]) => {
        if (!active) return
        setRecipes(applyPublishedIndex(bundledRecipes, remote, index))
        // 설정이 있는데 색인이 없으면 Firestore에 닿지 못한 것입니다. App Check 증명이 막혔거나 인터넷이 끊긴 때입니다.
        setStatus(index || !configured ? 'ready' : 'failed')
      })
      .catch(() => {
        if (active) setStatus('failed')
      })
    return () => {
      active = false
    }
  }, [])

  return { recipes, status }
}

export function usePublishedRecipes(): Recipe[] {
  return usePublishedCatalog().recipes
}

/** 목록·검색 화면이 함께 쓰는 문장. 원인이 화면 밖(네트워크)에 있음을 알려야 학생이 자기 탓을 하지 않습니다. */
export const CATALOG_FAILED_MESSAGE =
  '지금은 레시피 대부분을 불러오지 못했습니다. 인터넷 연결을 확인하고 새로 고침하세요. 학교 네트워크가 구글 reCAPTCHA를 막고 있으면 다른 네트워크에서 열어야 합니다.'
