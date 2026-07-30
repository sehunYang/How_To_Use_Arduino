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

export function usePublishedRecipes(): Recipe[] {
  const [recipes, setRecipes] = useState<Recipe[]>(bundledRecipes)

  useEffect(() => {
    let active = true
    void Promise.all([loadPublishedRecipes(), loadDynamicSearchIndex()])
      .then(([remote, index]) => {
        if (active) setRecipes(applyPublishedIndex(bundledRecipes, remote, index))
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  return recipes
}
