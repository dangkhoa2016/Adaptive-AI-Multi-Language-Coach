import type { Locale } from '@vocab/shared'

export interface Bindings {
  ASSETS: Fetcher
  CACHE: KVNamespace
  DB: D1Database
  RATE_LIMITER_API: RateLimit
  RATE_LIMITER_AUTH: RateLimit

  EMAIL_FROM: string
  EMAIL_FROM_NAME: string
  EMAIL_PROVIDER: string
  AWS_REGION: string

  JWT_SECRET?: string
  AWS_ACCESS_KEY_ID?: string
  AWS_SECRET_ACCESS_KEY?: string
  POSTMARK_SERVER_TOKEN?: string
  SENDPULSE_CLIENT_ID?: string
  SENDPULSE_CLIENT_SECRET?: string
  RESEND_API_KEY?: string
}

export interface Variables {
  locale: Locale
}
