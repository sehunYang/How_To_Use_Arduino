import { z } from 'zod'

export const StaticIssueSchema = z.object({
  /** L1 check identifier, e.g. "pin-duplicate", "i2c-address-conflict". */
  code: z.string().min(1),
  severity: z.enum(['warning', 'error']),
  message: z.string().min(1),
})
export type StaticIssue = z.infer<typeof StaticIssueSchema>

/**
 * CI-owned verification ledger entry (plan "핵심 아키텍처: 검증 원장").
 * Lives in its own top-level `simStatus/{recipeId}` collection — never a
 * field on `recipes` — so only the CI identity can write it and the
 * client-side SimBadge can gate on `verifyHash` matching (plan N4).
 */
export const SimStatusSchema = z.object({
  verifyHash: z.string().min(1),
  compilePass: z.boolean(),
  /** null = not simulated (e.g. sensor has wokwi.simSupported === false). */
  simPass: z.boolean().nullable(),
  logicPass: z.boolean(),
  staticIssues: z.array(StaticIssueSchema).default([]),
  verifiedAt: z.string().min(1),
})
export type SimStatus = z.infer<typeof SimStatusSchema>
