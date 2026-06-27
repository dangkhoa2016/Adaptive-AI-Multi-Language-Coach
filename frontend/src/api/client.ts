import type { Locale } from '@vocab/shared'

export interface VocabPair {
  source: string
  target: string
  exampleSource: string
  exampleTarget: string
  ipa: string
  pos: string
  isPhrase: boolean
}

export interface GenerateRequest {
  source: Locale
  target: Locale
  topic: string
  level: 'A1' | 'A2' | 'B1' | 'B2'
  count: number
  uiLocale: Locale
  mode: 'word' | 'phrase' | 'mix'
}

export interface GenerateResponse {
  pairs: VocabPair[]
  isFallback: boolean
  cacheHit: boolean
}

export interface QuizQuestion {
  pair: VocabPair
  options: string[]
  correctIndex: number
}

export interface QuizResponse {
  questions: QuizQuestion[]
}

export interface Topic {
  key: string
  label: string
}

export interface LocaleInfo {
  code: Locale
  label: string
}

interface ApiError {
  error: string
  message: string
}

const BASE = import.meta.env.DEV ? '/api' : '/api'

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; locale?: Locale } = {},
): Promise<T> {
  const { method = 'GET', body, locale } = options
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (locale) {
    headers['Accept-Language'] = locale
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 429) {
    const data = (await res.json().catch(() => null)) as ApiError | null
    throw Object.assign(new Error(data?.message ?? 'errors.rate_limited'), { status: 429 })
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as ApiError | null
    throw Object.assign(new Error(data?.message ?? 'errors.generic'), { status: res.status })
  }

  return res.json() as Promise<T>
}

export async function fetchLocales(): Promise<LocaleInfo[]> {
  const res = await request<{ locales: LocaleInfo[] }>('/locales')
  return res.locales
}

export async function fetchTopics(locale: Locale): Promise<Topic[]> {
  const res = await request<{ topics: Topic[] }>(`/topics?uiLocale=${locale}`)
  return res.topics
}

export async function generateVocab(req: GenerateRequest): Promise<GenerateResponse> {
  return request<GenerateResponse>('/generate', {
    method: 'POST',
    body: req,
    locale: req.uiLocale,
  })
}

export async function createQuiz(pairs: VocabPair[]): Promise<QuizResponse> {
  return request<QuizResponse>('/quiz', {
    method: 'POST',
    body: { pairs },
  })
}

export async function fetchTtsAudio(text: string, locale: string): Promise<Blob> {
  const res = await fetch(`${BASE}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, locale }),
  })

  if (!res.ok) {
    throw new Error('TTS request failed')
  }

  return res.blob()
}

export interface User {
  id: string
  email: string
  emailVerified: boolean
  activatedDate: string | null
  activationMethod: string | null
  timezone: string
  createdAt: string
}

export const requestMagicLink = (email: string) =>
  request<{ success: boolean }>('/auth/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })

export const verifyMagicLink = (token: string) =>
  request<{ success: boolean; user: User }>('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })

export const fetchCurrentUser = () => request<{ user: User }>('/auth/me')

export const logout = () => request<{ success: boolean }>('/auth/logout', { method: 'POST' })

export const exportUserData = () => request<unknown>('/user/export')

export interface LearnedPair {
  id: string
  user_id: string
  source: string
  target: string
  source_text: string
  target_text: string
  is_phrase: number
  ipa: string | null
  pos: string | null
  example_source: string | null
  example_target: string | null
  ease: number
  interval: number
  repetitions: number
  next_review: string | null
  last_seen: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface ReviewStats {
  dueCount: number
  learningCount: number
  masteredCount: number
  totalCount: number
}

export interface SaveVocabRequest {
  source: string
  target: string
  sourceText: string
  targetText: string
  isPhrase?: boolean
  ipa?: string
  pos?: string
  exampleSource?: string
  exampleTarget?: string
}

export async function fetchReviewStats(): Promise<ReviewStats> {
  return request<ReviewStats>('/review/stats')
}

export async function fetchDueCards(): Promise<LearnedPair[]> {
  const res = await request<{ pairs: LearnedPair[] }>('/review/due')
  return res.pairs
}

export async function gradeCard(learnedPairId: string, quality: number): Promise<LearnedPair> {
  const res = await request<{ pair: LearnedPair }>('/review/grade', {
    method: 'POST',
    body: { learnedPairId, quality },
  })
  return res.pair
}

export async function saveVocabPair(req: SaveVocabRequest): Promise<LearnedPair> {
  const res = await request<{ pair: LearnedPair }>('/vocab/save', {
    method: 'POST',
    body: req,
  })
  return res.pair
}

export async function resetCard(learnedPairId: string): Promise<LearnedPair> {
  const res = await request<{ pair: LearnedPair }>('/vocab/reset', {
    method: 'POST',
    body: { learnedPairId },
  })
  return res.pair
}

export interface ReviewLogEntry {
  id: string
  learnedPairId: string
  source: string
  target: string
  quality: number
  reviewedAt: string
}

export interface ReviewHistoryResponse {
  logs: ReviewLogEntry[]
  total: number
  page: number
  limit: number
}

export interface ReviewHistoryStats {
  totalReviews: number
  todayReviews: number
  thisWeek: number
  avgQuality: number
}

export async function fetchReviewHistory(page = 1, limit = 20): Promise<ReviewHistoryResponse> {
  return request<ReviewHistoryResponse>(`/review/history?page=${page}&limit=${limit}`)
}

export async function fetchReviewHistoryStats(): Promise<ReviewHistoryStats> {
  return request<ReviewHistoryStats>('/review/history/stats')
}

export async function submitSttAudio(
  audioBlob: Blob,
  reference: string,
): Promise<{ transcript: string; similarity: number | null }> {
  const res = await fetch(`${BASE}/stt?reference=${encodeURIComponent(reference)}`, {
    method: 'POST',
    body: audioBlob,
  })

  if (!res.ok) {
    throw new Error('STT request failed')
  }

  return res.json()
}
