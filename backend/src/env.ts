import type { Locale } from '@vocab/shared'

export interface Bindings {
  ASSETS: Fetcher
  CACHE: KVNamespace
  DB: D1Database
  RATE_LIMITER_API: RateLimit
  RATE_LIMITER_AUTH: RateLimit
  ENCRYPTION_KEY: string
  JWT_SECRET: string
  AI_PROVIDER_ORIGINS?: string
  PUBLIC_APP_ORIGIN?: string
  ENVIRONMENT?: string
  AI: Ai
}

export interface Variables {
  locale: Locale
  userId?: string
}
