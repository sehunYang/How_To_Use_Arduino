import { bioRoboticsProjectRecipes } from './bioRoboticsProjects'
import { phase5ProjectRecipes as physicsEnvironmentRecipes } from './projectRecipes'
import { sensorExampleRecipes } from './sensorExamples'

export { biologyProjectRecipes, roboticsProjectRecipes, bioRoboticsProjectRecipes } from './bioRoboticsProjects'
export {
  environmentProjectRecipes,
  physicsProjectRecipes,
  phase5ProjectRecipes as physicsEnvironmentProjectRecipes,
} from './projectRecipes'
export { phase5Rationales } from './rationales'
export { sensorExampleRecipes } from './sensorExamples'

export const phase5ProjectRecipes = [
  ...physicsEnvironmentRecipes,
  ...bioRoboticsProjectRecipes,
]
export const phase5Recipes = [
  ...sensorExampleRecipes,
  ...phase5ProjectRecipes,
]
