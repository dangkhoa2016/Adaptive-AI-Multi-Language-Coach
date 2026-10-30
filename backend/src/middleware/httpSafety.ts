import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Bindings, Variables } from '../env'

export function trustedOrigin(env: Bindings): string | null {
  try {
    const url = new URL(env.PUBLIC_APP_ORIGIN ?? '')
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null
    const local =
      env.ENVIRONMENT === 'local' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null
    return url.origin
  } catch {
    return null
  }
}

export const mutationSafety: MiddlewareHandler<{
  Bindings: Bindings
  Variables: Variables
}> = async (c, next) => {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(c.req.method)) return next()
  const origin = c.req.header('Origin')
  const site = c.req.header('Sec-Fetch-Site')
  const authenticatedCookie = getCookie(c, 'auth_token')
  // Non-browser, unauthenticated API clients are allowed; browser mutations must be same-origin.
  if (!origin && !authenticatedCookie && site !== 'cross-site') return next()
  const expected = trustedOrigin(c.env)
  if (!expected) return c.json({ error: 'service_unavailable' }, 503)
  if (site === 'cross-site' || !origin || origin !== expected)
    return c.json({ error: 'forbidden' }, 403)
  await next()
}
