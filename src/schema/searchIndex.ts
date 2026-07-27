import { z } from 'zod'
import { SubjectSchema, DifficultySchema } from './common'

/**
 * One entry per published recipe. Shipped two ways (plan 분기 ① Option D):
 * bundled at build time as `index.json` for instant first paint, and
 * mirrored to Firestore `meta/index` for background refresh after publish.
 */
export const SearchIndexEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subject: SubjectSchema.nullable(),
  difficulty: DifficultySchema,
  minutes: z.number().int().positive(),
  sensors: z.array(z.string()),
  actuators: z.array(z.string()),
  coreKeywords: z.array(z.string()),
  imageUrl: z.string().min(1),
})
export type SearchIndexEntry = z.infer<typeof SearchIndexEntrySchema>
