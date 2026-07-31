import type { Recipe } from '@/schema'
import type { ReadableLayout } from './readableLayout'
import { pendulumLayout } from './layouts/pendulumLayout'

const layouts = new Map<string, ReadableLayout>([
  ['pendulum', pendulumLayout],
])

export function layoutForRecipe(recipe: Recipe): ReadableLayout | null {
  return (recipe.layout as ReadableLayout | undefined) ?? layouts.get(recipe.id) ?? null
}
