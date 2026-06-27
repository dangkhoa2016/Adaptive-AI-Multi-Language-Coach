import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Bindings, Variables } from '../env'
import { verifyJwt } from '../services/auth'
import { t } from '../i18n'

export function requireAuth(): MiddlewareHandler<{
  Bindings: Bindings
  Variables: Variables
}> {
  return async (c, next) => {
    const token = getCookie(c, 'auth_token')
    if (!token) {
      return c.json({ error: 'unauthorized', message: t(c, 'errors.unauthorized') }, 401)
    }
    const payload = await verifyJwt(token, c.env.JWT_SECRET)
    if (!payload) {
      return c.json({ error: 'unauthorized', message: t(c, 'errors.unauthorized') }, 401)
    }
    c.set('userId', payload.sub)
    await next()
  }
}
