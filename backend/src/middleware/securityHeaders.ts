import type { MiddlewareHandler } from 'hono'

export function securityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    c.header('Cache-Control', 'private, no-store')
    c.header('X-Content-Type-Options', 'nosniff')
    c.header('X-Frame-Options', 'DENY')
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    c.header('Permissions-Policy', 'geolocation=(), microphone=()')

    await next()
  }
}
