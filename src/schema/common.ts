import { z } from 'zod'

export const SubjectSchema = z.enum(['물리', '화학·환경', '생물', '공학·로봇'])
export type Subject = z.infer<typeof SubjectSchema>

export const DifficultySchema = z.enum(['초급', '중급', '고급'])
export type Difficulty = z.infer<typeof DifficultySchema>

/** Only board supported in v1 (plan decision R8). */
export const BoardSchema = z.literal('uno-r3')
export type Board = z.infer<typeof BoardSchema>
