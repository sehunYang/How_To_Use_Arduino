import { z } from 'zod'

/**
 * Anonymous-only telemetry (spec G2). No name/student-id/email field exists
 * anywhere in this schema by construction — there is nothing to strip.
 */
export const AnonEventSchema = z.object({
  anonId: z.string().min(1).max(64),
  recipeId: z.string().min(1),
  step: z.number().int().nonnegative().optional(),
  event: z.enum(['start', 'step_check', 'complete', 'search_fail']),
  at: z.string().min(1),
})
export type AnonEvent = z.infer<typeof AnonEventSchema>
