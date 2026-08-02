import { canaryPlans } from './plansCanary'
import { phase5Plans } from './plansPhase5'
import { phase6Plans } from './plansPhase6'
import { phase7Plans } from './plansPhase7'
import type { InquiryPlan } from './types'

/** 레시피 id로 찾는 탐구 설계. 모든 단계의 계획을 하나로 합칩니다. */
export const inquiryPlans: Record<string, InquiryPlan> = {
  ...canaryPlans,
  ...phase5Plans,
  ...phase6Plans,
  ...phase7Plans,
}

export { canaryPlans, phase5Plans, phase6Plans, phase7Plans }
export type { InquiryPlan } from './types'
