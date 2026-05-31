import type { MiddlewareHandler } from 'hono'
import type { Variables, Bindings } from '../env'

export function structuredLogger(): MiddlewareHandler<{
  Bindings: Bindings
  Variables: Variables
}> {
  return async (c, next) => {
    const start = Date.now()
    const method = c.req.method
    const path = c.req.path
    const reqId = crypto.randomUUID()

    await next()

    const ms = Date.now() - start
    const entry = {
      timestamp: new Date().toISOString(),
      requestId: reqId,
      method,
      path,
      status: c.res.status,
      durationMs: ms,
      remote: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown',
    }

    if (c.res.status >= 500) {
      console.error(JSON.stringify(entry))
    } else {
      console.log(JSON.stringify(entry))
    }
  }
}
