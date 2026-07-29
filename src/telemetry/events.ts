import { AnonEventSchema, type AnonEvent } from '@/schema'
import { ensureAppCheck, getClientApp } from '@/firebase/clientApp'

const ANON_ID_KEY = 'arduino-anon-id:v1'

function anonymousId(storage?: Storage): string {
  if (!storage) return crypto.randomUUID()
  const current = storage.getItem(ANON_ID_KEY)
  if (current) return current
  const created = crypto.randomUUID()
  try {
    storage.setItem(ANON_ID_KEY, created)
  } catch {
    // Telemetry is optional; storage restrictions must not block learning.
  }
  return created
}

export interface StudentEventInput {
  recipeId: string
  event: AnonEvent['event']
  step?: number
  tokens?: string[]
}

export type EventTransport = (event: AnonEvent) => Promise<void>

export function buildAnonymousEvent(input: StudentEventInput, storage?: Storage): AnonEvent {
  return AnonEventSchema.parse({
    anonId: anonymousId(storage),
    recipeId: input.recipeId,
    event: input.event,
    ...(input.step === undefined ? {} : { step: input.step }),
    ...(input.tokens === undefined ? {} : { tokens: input.tokens }),
    at: new Date().toISOString(),
  })
}

export function normalizeSearchTokens(query: string): string[] {
  return [...new Set(
    query
      .normalize('NFKC')
      .toLocaleLowerCase('ko')
      .match(/[가-힣a-z0-9]+/g) ?? [],
  )].slice(0, 20)
}

async function firestoreTransport(event: AnonEvent): Promise<void> {
  const app = await getClientApp()
  if (!app || !(await ensureAppCheck(app))) return
  const { addDoc, collection, getFirestore, serverTimestamp } = await import('firebase/firestore')
  await addDoc(collection(getFirestore(app), 'events'), { ...event, at: serverTimestamp() })
}

export function sendAnonymousEvent(
  input: StudentEventInput,
  transport: EventTransport = firestoreTransport,
  storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): Promise<void> {
  return transport(buildAnonymousEvent(input, storage))
}
