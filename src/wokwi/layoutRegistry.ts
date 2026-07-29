import type { ReadableLayout } from './readableLayout'
import { ina219CurrentLayout } from './layouts/ina219CurrentLayout'
import { pendulumLayout } from './layouts/pendulumLayout'

const layouts = new Map<string, ReadableLayout>([
  ['pendulum', pendulumLayout],
  ['ina219-current', ina219CurrentLayout],
])

export function layoutForRecipe(recipeId: string): ReadableLayout | null {
  return layouts.get(recipeId) ?? null
}
