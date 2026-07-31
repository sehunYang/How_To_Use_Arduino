import type { Recipe } from '@/schema'
import type { ReadableLayout } from './readableLayout'

export function layoutForRecipe(recipe: Recipe): ReadableLayout | null {
  const embedded = recipe.layout as ReadableLayout | undefined
  if (!embedded?.parts.some((part) => part.id === 'bb' && part.type.includes('breadboard'))) {
    return null
  }
  const routesUnoPowerThroughBreadboard = embedded.wires.every((wire) => {
    const fromUno = wire.from.startsWith('uno:')
    const toUno = wire.to.startsWith('uno:')
    if (!fromUno && !toUno) return true
    const unoEndpoint = fromUno ? wire.from : wire.to
    const unoPin = unoEndpoint.slice('uno:'.length).toUpperCase()
    if (!['5V', '3.3V', 'GND'].includes(unoPin)) return true
    const other = fromUno ? wire.to : wire.from
    return other.startsWith('bb:')
  })
  if (!routesUnoPowerThroughBreadboard) return null
  return embedded
}
