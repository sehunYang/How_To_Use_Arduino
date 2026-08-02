import { phase7BioProjects } from './bioProjects'
import { phase7ChemistryProjects } from './chemistryProjects'
import { phase7EngineeringProjects } from './engineeringProjects'
import { phase7OutputExamples } from './outputExamples'
import { phase7PhysicsProjects } from './physicsProjects'
import { withFormattedSketch, withInquiryWorkbook } from '../inquiryGuide'
import { phase7Plans } from '../inquiry/plansPhase7'

export { phase7OutputExamples } from './outputExamples'
export { phase7BioProjects } from './bioProjects'
export { phase7ChemistryProjects } from './chemistryProjects'
export { phase7EngineeringProjects } from './engineeringProjects'
export { phase7PhysicsProjects } from './physicsProjects'

/**
 * 묶음 순서는 학생이 읽는 순서이기도 합니다. 장치를 하나씩 다루는 A를 먼저
 * 두고, 그 장치를 실제 탐구에 쓰는 B·C·D·E를 뒤에 둡니다.
 */
export const phase7Recipes = [
  ...phase7OutputExamples,
  ...phase7BioProjects,
  ...phase7ChemistryProjects,
  ...phase7EngineeringProjects,
  ...phase7PhysicsProjects,
].map(withInquiryWorkbook(phase7Plans)).map(withFormattedSketch)
