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
  /** Short application-guide copy shown on fallback result cards (A1.2). */
  applicationGuideExcerpt: z.string().min(1),
  /**
   * 이 탐구가 답하려는 질문. 카드가 레시피를 구별해 보여 주는 줄입니다.
   * 예전에 게시된 색인에는 없으므로 기본값을 둡니다.
   */
  question: z.string().default(''),
})
export type SearchIndexEntry = z.infer<typeof SearchIndexEntrySchema>
