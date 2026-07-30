import { canaryRationales, canarySimStatus, ina219CurrentRecipe, multiTsl2591Recipe, pendulumRecipe } from '@/data/canary'
import { phase5Rationales } from '@/data/phase5/rationales'
import { sensors } from '@/data/inventory-seed/sensors'

export const studentRecipes = [pendulumRecipe, ina219CurrentRecipe, multiTsl2591Recipe]
export const publishedRecipes = studentRecipes.filter((recipe) => recipe.status === 'published')

export const sensorById = new Map(sensors.map((sensor) => [sensor.id, sensor]))
export const rationaleBySensor = new Map(
  [...canaryRationales, ...phase5Rationales].map((rationale) => [
    `${rationale.sensorId}:${rationale.subject ?? '*'}`,
    rationale,
  ]),
)

export function rationaleFor(sensorId: string, subject: string | null) {
  return (
    rationaleBySensor.get(`${sensorId}:${subject ?? '*'}`) ??
    rationaleBySensor.get(`${sensorId}:*`)
  )
}

export { canarySimStatus }
