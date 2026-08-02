import { AnonEventSchema, type AnonEvent } from '@/schema'
import { ensureAppCheck, getClientApp } from '@/firebase/clientApp'

const ANON_ID_KEY = 'arduino-anon-id:v1'

/**
 * `crypto.randomUUID()`는 보안 컨텍스트(https 또는 localhost)에서만 있습니다.
 * 학교 안에서 http 주소로 열어 보는 경우처럼 없는 곳에서 그대로 부르면 예외가 나고,
 * 익명 통계 한 줄 때문에 화면 전체가 오류 안내로 바뀝니다. 통계는 학습에 필요한
 * 기능이 아니므로, 없으면 무작위 문자열로 대신하고 화면은 그대로 둡니다.
 */
function createAnonId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `anon-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

function anonymousId(storage?: Storage): string {
  if (!storage) return createAnonId()
  const current = storage.getItem(ANON_ID_KEY)
  if (current) return current
  const created = createAnonId()
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
