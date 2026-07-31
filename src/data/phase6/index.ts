import { phase6PinRecipes } from './pinRecipes'
import { phase6PhysicsRecipes } from './physicsRecipes'
import { withInquiryWorkbook } from '../inquiryGuide'

export { phase6PinRecipes } from './pinRecipes'
export { phase6PhysicsDefinitions, phase6PhysicsRecipes } from './physicsRecipes'

export const phase6Recipes = [
  ...phase6PinRecipes,
  ...phase6PhysicsRecipes,
].map(withInquiryWorkbook)
