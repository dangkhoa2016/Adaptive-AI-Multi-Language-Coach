import { Hono } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import type { Bindings, Variables } from '../env'
import { t } from '../i18n'
import { createJwt, generateMagicToken, hashToken, verifyJwt } from '../services/auth'
import { requireAuth } from '../middleware/auth'
import { createRateLimitMiddleware } from '../middleware/rateLimit'
import { sendEmail } from '../services/mail'
import { consumeBudget } from '../services/requestQuota'

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Limit only auth mutations: child-router wildcard middleware also matches sibling /api routes.
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function applicationConfig(env: Bindings): { origin: string; secure: boolean } | null {
  try {
    const url = new URL(env.PUBLIC_APP_ORIGIN ?? '')
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null
    const local =
      env.ENVIRONMENT === 'local' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null
    if (!env.JWT_SECRET?.trim()) return null
    return { origin: url.origin, secure: url.protocol === 'https:' }
  } catch {
    return null
  }
}

router.post('/auth/request', createRateLimitMiddleware('RATE_LIMITER_AUTH'), async (c) => {
  const { email } = (await c.req.json<{ email?: unknown }>().catch(() => null)) ?? {}
  if (typeof email !== 'string' || email.trim().length > 254 || !validateEmail(email.trim())) {
    return c.json({ error: 'invalid_email', message: t(c, 'errors.invalid_email') }, 400)
  }

  const config = applicationConfig(c.env)
  if (!config) return c.json({ error: 'auth_unavailable' }, 503)
  const normalizedEmail = email.trim().toLowerCase()
  try {
    const allowed = await consumeBudget(
      c.env.DB,
      `auth-email:${await hashToken(normalizedEmail)}`,
      3,
      'auth-global',
      200,
      3600,
    )
    if (!allowed) {
      c.header('Retry-After', '3600')
      return c.json({ error: 'rate_limited', message: t(c, 'errors.rate_limited') }, 429)
    }
  } catch {
    return c.json({ error: 'auth_unavailable' }, 503)
  }

  const raw = generateMagicToken()
  const tokenHash = await hashToken(raw)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  await c.env.DB.prepare(
    `INSERT INTO magic_tokens (token_hash, email, expires_at) VALUES (?, ?, ?)`,
  )
    .bind(tokenHash, normalizedEmail, expiresAt)
    .run()

  const magicLink = `${config.origin}/auth/verify?token=${encodeURIComponent(raw)}`

  const htmlLink = magicLink.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  )

  const sent = await sendEmail(c.env.DB, {
    to: normalizedEmail,
    subject: 'Your AI Vocab Coach magic sign-in link',
    html: `<p>Click the link below to sign in to AI Vocab Coach:</p><p><a href="${htmlLink}">${htmlLink}</a></p><p>This link expires in 15 minutes.</p>`,
    from: 'noreply@vocab.app',
  }).catch(() => {
    console.log('[auth] mail_delivery_error')
    return false
  })

  if (!sent) {
    console.log('[auth] mail_delivery_failed')
  }

  return c.json({ success: true, message: t(c, 'auth.link_sent') })
})

router.post('/auth/verify', createRateLimitMiddleware('RATE_LIMITER_AUTH'), async (c) => {
  const { token } = (await c.req.json<{ token?: unknown }>().catch(() => null)) ?? {}
  if (typeof token !== 'string' || token.length === 0) {
    return c.json({ error: 'invalid_token', message: t(c, 'errors.invalid_token') }, 400)
  }

  const config = applicationConfig(c.env)
  if (!config) return c.json({ error: 'auth_unavailable' }, 503)
  const tokenHash = await hashToken(token)
  // A single conditional statement claims the token, including under concurrent requests.
  const row = await c.env.DB.prepare(
    `UPDATE magic_tokens SET used = 1 WHERE token_hash = ? AND used = 0 AND expires_at > ? RETURNING email`,
  )
    .bind(tokenHash, new Date(Date.now()).toISOString())
    .first<{ email: string }>()
  if (!row) {
    return c.json({ error: 'invalid_token', message: t(c, 'errors.invalid_token') }, 401)
  }

  const email = row.email
  await c.env.DB.prepare(
    `INSERT INTO users (id, email, email_verified, activated_date, activation_method)
     VALUES (?, ?, 1, CURRENT_TIMESTAMP, 'open_email')
     ON CONFLICT(email) DO UPDATE SET email_verified = 1, activation_method = 'open_email', updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(crypto.randomUUID(), email)
    .run()
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string }>()
  if (!user) throw new Error('User provisioning failed')
  const userId = user.id

  // Issue JWT cookie
  const jwt = await createJwt(userId, c.env.JWT_SECRET)
  setCookie(c, 'auth_token', jwt, {
    httpOnly: true,
    secure: config.secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 86400,
  })

  return c.json({ success: true, user: { id: userId, email } })
})

router.post('/auth/logout', createRateLimitMiddleware('RATE_LIMITER_AUTH'), async (c) => {
  const config = applicationConfig(c.env)
  if (!config) return c.json({ error: 'auth_unavailable' }, 503)
  const token = getCookie(c, 'auth_token')
  if (token) {
    const payload = await verifyJwt(token, c.env.JWT_SECRET)
    if (payload) {
      await c.env.DB.prepare(
        'INSERT OR IGNORE INTO revoked_sessions (token_hash, expires_at) VALUES (?, ?)',
      )
        .bind(await hashToken(token), payload.exp)
        .run()
    }
  }
  deleteCookie(c, 'auth_token', {
    path: '/',
    httpOnly: true,
    secure: config.secure,
    sameSite: 'Lax',
  })
  return c.json({ success: true })
})

router.get('/auth/me', requireAuth(), async (c) => {
  const userId = c.get('userId')!
  const user = await c.env.DB.prepare(
    `SELECT id, email, email_verified, activated_date, activation_method, timezone, created_at FROM users WHERE id = ?`,
  )
    .bind(userId)
    .first<{
      id: string
      email: string
      email_verified: number
      activated_date: string | null
      activation_method: string | null
      timezone: string
      created_at: string
    }>()

  if (!user) {
    return c.json({ error: 'user_not_found', message: t(c, 'errors.user_not_found') }, 404)
  }

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      emailVerified: !!user.email_verified,
      activatedDate: user.activated_date,
      activationMethod: user.activation_method,
      timezone: user.timezone,
      createdAt: user.created_at,
    },
  })
})

export { router as authRouter }
