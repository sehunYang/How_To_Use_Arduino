import type { Recipe } from '@/schema'
import type { ReadableLayout } from './readableLayout'

export function layoutForRecipe(recipe: Recipe): ReadableLayout | null {
  const embedded = recipe.layout as ReadableLayout | undefined
  if (!embedded?.parts.some((part) => part.id === 'bb' && part.type.includes('breadboard'))) {
    return null
  }
  const routesUnoThroughBreadboard = embedded.wires.every((wire) => {
    const fromUno = wire.from.startsWith('uno:')
    const toUno = wire.to.startsWith('uno:')
    if (!fromUno && !toUno) return true
    const other = fromUno ? wire.to : wire.from
    return other.startsWith('bb:')
  })
  if (!routesUnoThroughBreadboard) return null
  return embedded
}
