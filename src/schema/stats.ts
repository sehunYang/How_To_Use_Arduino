import { z } from 'zod'

/**
 * Cron-derived rollup (plan N9) — never written by the client. Keeps the
 * teacher dashboard's read cost to ~1 doc/recipe instead of scanning the
 * entire `events` collection, and removes the unauthenticated-write path a
 * client-side increment design would otherwise leave open.
 */
export const StatsSchema = z.object({
  started: z.number().int().nonnegative().default(0),
  completed: z.number().int().nonnegative().default(0),
  /** step index (as string key) -> dropout count at that step */
  dropAtStep: z.record(z.string(), z.number().int().nonnegative()).default({}),
  /** ISO timestamp cursor: events at/after this point are unprocessed. */
  processedThrough: z.string().min(1).nullable().default(null),
})
export type Stats = z.infer<typeof StatsSchema>

export const SearchFailureStatsSchema = z.object({
  tokens: z.record(z.string(), z.number().int().nonnegative()).default({}),
  processedThrough: z.string().min(1).nullable().default(null),
})
export type SearchFailureStats = z.infer<typeof SearchFailureStatsSchema>
