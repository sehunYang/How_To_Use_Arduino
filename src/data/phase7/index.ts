import { phase7OutputExamples } from './outputExamples'
import { withFormattedSketch, withInquiryWorkbook } from '../inquiryGuide'
import { phase7Plans } from '../inquiry/plansPhase7'

export { phase7OutputExamples } from './outputExamples'

export const phase7Recipes = [
  ...phase7OutputExamples,
].map(withInquiryWorkbook(phase7Plans)).map(withFormattedSketch)
