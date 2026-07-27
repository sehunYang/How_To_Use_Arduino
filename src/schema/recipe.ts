import { z } from 'zod'
import { SubjectSchema, DifficultySchema, BoardSchema } from './common'

export const FocusRegionSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
})
export type FocusRegion = z.infer<typeof FocusRegionSchema>

export const WiringStepSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  color: z.string().min(1),
  focus: FocusRegionSchema,
  text: z.string().min(1),
})
export type WiringStep = z.infer<typeof WiringStepSchema>

/**
 * `anchor` (a `// @tunable name` marker string), never a line number —
 * inserting a comment above a raw line number would silently desync the
 * highlighted line from the actual tunable (plan N11 / spec A3.3).
 */
export const TunableParamSchema = z.object({
  anchor: z.string().min(1),
  name: z.string().min(1),
  hint: z.string().min(1),
})
export type TunableParam = z.infer<typeof TunableParamSchema>

export const TroubleshootingItemSchema = z.object({
  symptom: z.string().min(1),
  cause: z.string().min(1),
  fix: z.string().min(1),
})
export type TroubleshootingItem = z.infer<typeof TroubleshootingItemSchema>

/**
 * A human-review flag that expires on edit: it is valid only while its
 * stored `verifyHash` still matches the recipe's current hash (plan E4).
 * `null` means "never reviewed" or "reviewed on a since-superseded version".
 */
export const ReviewFlagSchema = z
  .object({
    at: z.string().min(1),
    verifyHash: z.string().min(1),
  })
  .nullable()
export type ReviewFlag = z.infer<typeof ReviewFlagSchema>

export const RecipeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['sensor-example', 'project']),
  title: z.string().min(1),
  subject: SubjectSchema.nullable(),
  difficulty: DifficultySchema,
  minutes: z.number().int().positive(),
  board: BoardSchema,
  sensors: z.array(z.string()).default([]),
  actuators: z.array(z.string()).default([]),
  coreKeywords: z.array(z.string()).default([]),
  imageUrl: z.string().min(1),
  /**
   * Pixel dimensions of the image at `imageUrl` (the natural size the
   * drag-to-select focus editor in Phase 4.3 will read/write against).
   * Required so L1 can actually check `WiringStep.focus` rectangles are
   * within image bounds (plan check #6's other half — previously deferred
   * because this field didn't exist).
   */
  imageWidth: z.number().int().positive(),
  imageHeight: z.number().int().positive(),
  wiring: z.array(WiringStepSchema).default([]),
  sketch: z.string().min(1),
  baudRate: z.number().int().positive(),
  tunables: z.array(TunableParamSchema).default([]),
  body: z.string().min(1),
  applicationGuide: z.string().default(''),
  troubleshooting: z.array(TroubleshootingItemSchema).default([]),
  /** Draft/published split (plan N1) so L1 can run in two severity modes. */
  status: z.enum(['draft', 'published']).default('draft'),
  reviewedOnDevice: ReviewFlagSchema.default(null),
  commentReviewed: ReviewFlagSchema.default(null),
  updatedAt: z.string().min(1),
})
export type Recipe = z.infer<typeof RecipeSchema>
