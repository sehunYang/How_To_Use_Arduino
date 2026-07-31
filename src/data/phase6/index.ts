import { phase6PinRecipes } from './pinRecipes'
import { phase6PhysicsRecipes } from './physicsRecipes'
import { withFormattedSketch, withInquiryWorkbook } from '../inquiryGuide'
import { phase6Plans } from '../inquiry/plansPhase6'

export { phase6PinRecipes } from './pinRecipes'
export { phase6PhysicsDefinitions, phase6PhysicsRecipes } from './physicsRecipes'

export const phase6Recipes = [
  ...phase6PinRecipes,
  ...phase6PhysicsRecipes,
].map(withInquiryWorkbook(phase6Plans)).map(withFormattedSketch)
