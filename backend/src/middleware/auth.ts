import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Bindings, Variables } from '../env'
import { hashToken, verifyJwt } from '../services/auth'
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
    const revoked = payload
      ? await c.env.DB.prepare(
          'SELECT token_hash FROM revoked_sessions WHERE token_hash = ? AND expires_at > ?',
        )
          .bind(await hashToken(token), Math.floor(Date.now() / 1000))
          .first()
      : null
    if (!payload || revoked) {
      return c.json({ error: 'unauthorized', message: t(c, 'errors.unauthorized') }, 401)
    }
    c.set('userId', payload.sub)
    await next()
  }
}

export function requireAdmin(): MiddlewareHandler<{
  Bindings: Bindings
  Variables: Variables
}> {
  return async (c, next) => {
    const userId = c.var.userId
    if (!userId) {
      return c.json({ error: 'forbidden', message: 'Admin access required' }, 403)
    }
    const result = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?')
      .bind(userId)
      .first<{ role: string }>()
    if (!result || result.role !== 'admin') {
      return c.json({ error: 'forbidden', message: 'Admin access required' }, 403)
    }
    await next()
  }
}
