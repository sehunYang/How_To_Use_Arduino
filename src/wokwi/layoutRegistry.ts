import type { Recipe } from '@/schema'
import type { ReadableLayout } from './readableLayout'
import { ina219CurrentLayout } from './layouts/ina219CurrentLayout'
import { pendulumLayout } from './layouts/pendulumLayout'

const layouts = new Map<string, ReadableLayout>([
  ['pendulum', pendulumLayout],
  ['ina219-current', ina219CurrentLayout],
])

export function layoutForRecipe(recipe: Recipe): ReadableLayout | null {
  return (recipe.layout as ReadableLayout | undefined) ?? layouts.get(recipe.id) ?? null
}
