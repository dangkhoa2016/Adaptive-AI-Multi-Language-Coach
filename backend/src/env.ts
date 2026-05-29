import type { Locale } from '@vocab/shared'

export interface Bindings {
  ASSETS: Fetcher
  CACHE: KVNamespace
  DB: D1Database
  RATE_LIMITER_API: RateLimit
  RATE_LIMITER_AUTH: RateLimit
  ENCRYPTION_KEY: string
}

export interface Variables {
  locale: Locale
}
