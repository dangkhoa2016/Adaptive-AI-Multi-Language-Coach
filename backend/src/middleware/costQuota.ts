import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Bindings, Variables } from '../env'
import { consumeBudget } from '../services/requestQuota'
import { hashToken, verifyJwt } from '../services/auth'

/** Durable global and per-account/guest daily budgets, in addition to native minute quotas. */
export async function enforceCostQuota(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
): Promise<Response | null> {
  try {
    let user: string | undefined
    const token = getCookie(c, 'auth_token')
    if (token) {
      const payload = await verifyJwt(token, c.env.JWT_SECRET)
      if (!payload) return c.json({ error: 'unauthorized' }, 401)
      const revoked = await c.env.DB.prepare(
        'SELECT token_hash FROM revoked_sessions WHERE token_hash = ? AND expires_at > ?',
      )
        .bind(await hashToken(token), Math.floor(Date.now() / 1000))
        .first()
      if (revoked) return c.json({ error: 'unauthorized' }, 401)
      user = payload.sub
    }
    const principal = user
      ? `user:${user}`
      : `guest:${c.req.header('CF-Connecting-IP') ?? 'unknown'}`
    const allowed = await consumeBudget(
      c.env.DB,
      `cost:${principal}`,
      user ? 100 : 20,
      'cost:global',
      500,
      86400,
    )
    if (!allowed) {
      c.header('Retry-After', '86400')
      return c.json({ error: 'rate_limited' }, 429)
    }
    return null
  } catch {
    return c.json({ error: 'service_unavailable' }, 503)
  }
}
