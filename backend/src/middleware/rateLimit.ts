import type { MiddlewareHandler } from 'hono'
import type { Bindings, Variables } from '../env'
import { t } from '../i18n'

/**
 * Creates a rate-limiting middleware that checks RATE_LIMITER_API.
 * Returns 429 if the limit is exceeded.
 */
export function createRateLimitMiddleware(): MiddlewareHandler<{
  Bindings: Bindings
  Variables: Variables
}> {
  return async (c, next) => {
    const ip =
      c.req.header('cf-connecting-ip') ?? c.req.raw.headers.get('x-forwarded-for') ?? 'unknown'
    const result = await c.env.RATE_LIMITER_API.limit({ key: ip })
    if (result.success === false) {
      return c.json({ error: 'rate_limited', message: t(c, 'errors.rate_limited') }, 429)
    }
    await next()
  }
}
