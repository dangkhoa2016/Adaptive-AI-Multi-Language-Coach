import type { MiddlewareHandler } from 'hono'
import type { Bindings, Variables } from '../env'
import { t } from '../i18n'

type RateLimiterBinding = 'RATE_LIMITER_API' | 'RATE_LIMITER_AUTH'

/**
 * Creates a rate-limiting middleware.
 * Specify `binding` to choose which rate limiter to use (default: RATE_LIMITER_API).
 * Returns 429 if the limit is exceeded.
 */
export function createRateLimitMiddleware(
  binding: RateLimiterBinding = 'RATE_LIMITER_API',
): MiddlewareHandler<{
  Bindings: Bindings
  Variables: Variables
}> {
  return async (c, next) => {
    const ip =
      c.req.header('cf-connecting-ip') ?? c.req.raw.headers.get('x-forwarded-for') ?? 'unknown'
    const limiter =
      binding === 'RATE_LIMITER_AUTH' ? c.env.RATE_LIMITER_AUTH : c.env.RATE_LIMITER_API
    const result = await limiter.limit({ key: ip })
    if (result.success === false) {
      return c.json({ error: 'rate_limited', message: t(c, 'errors.rate_limited') }, 429)
    }
    await next()
  }
}
