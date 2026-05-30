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
