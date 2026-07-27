import { z } from 'zod'
import { SubjectSchema } from './common'

/**
 * "왜 이 센서인가" text (spec A2.2), keyed by (sensor, subject) so the same
 * sensor can carry a different rationale per inquiry context.
 */
export const SensorRationaleSchema = z.object({
  sensorId: z.string().min(1),
  subject: SubjectSchema.nullable(),
  whyText: z.string().min(1),
})
export type SensorRationale = z.infer<typeof SensorRationaleSchema>
